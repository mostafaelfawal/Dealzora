/**
 * عميل الـ API: تجديد التوكن (مرة واحدة للطلبات المتزامنة)، انتهاء الجلسة، شاشة الترقية،
 * انقطاع الإنترنت، ورسائل الأخطاء بالعربي. خادم وهمي بـ fetch مُبرمج (بدون شبكة).
 */
import { ApiClient, type TokenStore } from "../client";
import { NETWORK_MESSAGE, SERVER_MESSAGE, TIMEOUT_MESSAGE } from "../errors";
import type { MobileTokens, StoredTokens } from "../types";

const BASE = "https://sync.example.com";
const NOW = Date.parse("2026-11-15T10:00:00Z");
const inMinutes = (m: number) => new Date(NOW + m * 60_000).toISOString();

const USER = {
  account_id: "acc-1",
  username: "owner",
  role: "owner" as const,
  shop_id: "shop-1",
  shop_name: "سوبر ماركت النور",
  branch_ids: ["b1"],
};

function tokensOut(n: number, expiresInMin = 10): MobileTokens {
  return {
    access_token: `access-${n}`,
    token_type: "bearer",
    expires_at: inMinutes(expiresInMin),
    refresh_token: `sess.refresh-${n}`,
    refresh_expires_at: inMinutes(60 * 24 * 30),
    session_id: "sess",
    user: USER,
  };
}

function stored(n: number, expiresInMin = 10): StoredTokens {
  const t = tokensOut(n, expiresInMin);
  return {
    access_token: t.access_token,
    expires_at: t.expires_at,
    refresh_token: t.refresh_token,
    session_id: t.session_id,
  };
}

class MemoryStore implements TokenStore {
  constructor(public value: StoredTokens | null = null) {}
  load = jest.fn(async () => this.value);
  save = jest.fn(async (t: StoredTokens) => {
    this.value = t;
  });
  clear = jest.fn(async () => {
    this.value = null;
  });
}

type Handler = (url: string, init: RequestInit) => Promise<Response> | Response;

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const errorBody = (code: string, message: string, details: unknown = null) => ({
  error: { code, message, details },
});

function setup(
  store: MemoryStore,
  handler: Handler,
  extra: Partial<ConstructorParameters<typeof ApiClient>[0]> = {},
) {
  const fetchMock = jest.fn((url: string, init: RequestInit) =>
    Promise.resolve(handler(url, init)),
  );
  const onSessionEnded = jest.fn();
  const onPlanBlocked = jest.fn();
  const onUser = jest.fn();
  const client = new ApiClient({
    baseUrl: () => BASE,
    tokens: store,
    fetch: fetchMock as unknown as typeof fetch,
    now: () => NOW,
    onSessionEnded,
    onPlanBlocked,
    onUser,
    ...extra,
  });
  return { client, fetchMock, onSessionEnded, onPlanBlocked, onUser };
}

const auth = (init: RequestInit) =>
  (init.headers as Record<string, string>).Authorization;
const path = (url: string) => url.replace(`${BASE}/mobile/v1`, "");

describe("ApiClient", () => {
  test("يرفق توكن الوصول ويرجع البيانات", async () => {
    const store = new MemoryStore(stored(1));
    const { client, fetchMock } = setup(store, (url, init) => {
      expect(url).toBe(`${BASE}/mobile/v1/me`);
      expect(auth(init)).toBe("Bearer access-1");
      return json(200, USER);
    });
    await expect(client.get("/me")).resolves.toEqual(USER);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("يجدد قبل الطلب لو التوكن قارب على الانتهاء ويحفظ الجديد", async () => {
    const store = new MemoryStore(stored(1, 0)); // ينتهي الآن
    const { client, fetchMock, onUser } = setup(store, (url, init) => {
      if (path(url) === "/auth/refresh") {
        expect(JSON.parse(init.body as string)).toEqual({
          refresh_token: "sess.refresh-1",
        });
        expect(auth(init)).toBeUndefined();
        return json(200, tokensOut(2));
      }
      expect(auth(init)).toBe("Bearer access-2");
      return json(200, USER);
    });
    await client.get("/me");
    expect(fetchMock.mock.calls.map(([u]) => path(u))).toEqual([
      "/auth/refresh",
      "/me",
    ]);
    expect(store.value?.refresh_token).toBe("sess.refresh-2");
    expect(onUser).toHaveBeenCalledWith(USER);
  });

  test("token_expired من الخادم ← تجديد ثم إعادة الطلب مرة واحدة", async () => {
    const store = new MemoryStore(stored(1));
    const { client, fetchMock } = setup(store, (url, init) => {
      if (path(url) === "/auth/refresh") return json(200, tokensOut(2));
      if (auth(init) === "Bearer access-1")
        return json(401, errorBody("token_expired", "انتهى التوكن"));
      return json(200, { ok: true });
    });
    await expect(client.get("/branches")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.map(([u]) => path(u))).toEqual([
      "/branches",
      "/auth/refresh",
      "/branches",
    ]);
  });

  test("لا حلقة: token_expired بعد التجديد يفشل بدل التكرار", async () => {
    const store = new MemoryStore(stored(1));
    const { client, fetchMock } = setup(store, (url) =>
      path(url) === "/auth/refresh"
        ? json(200, tokensOut(2))
        : json(401, errorBody("token_expired", "انتهى التوكن")),
    );
    await expect(client.get("/me")).rejects.toMatchObject({
      code: "token_expired",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("طلبات متزامنة بتوكن منتهٍ = تجديد واحد فقط (الخادم يلغي الجلسة لو refresh قديم رجع)", async () => {
    const store = new MemoryStore(stored(1, 0));
    let refreshes = 0;
    const { client } = setup(store, async (url, init) => {
      if (path(url) === "/auth/refresh") {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 10));
        return json(200, tokensOut(1 + refreshes));
      }
      expect(auth(init)).toBe("Bearer access-2");
      return json(200, { path: path(url) });
    });
    const results = await Promise.all([
      client.get("/me"),
      client.get("/branches"),
      client.get("/sessions"),
    ]);
    expect(results).toHaveLength(3);
    expect(refreshes).toBe(1);
  });

  test("طلب فشل بتوكن قديم بعد أن جدّد طلب آخر: يستخدم التوكن الجديد بلا تجديد ثانٍ", async () => {
    const store = new MemoryStore(stored(1));
    let refreshes = 0;
    let releaseSlow: () => void = () => {};
    const slowGate = new Promise<void>((r) => {
      releaseSlow = r;
    });
    const { client } = setup(store, async (url, init) => {
      const p = path(url);
      if (p === "/auth/refresh") {
        refreshes += 1;
        return json(200, tokensOut(2));
      }
      if (auth(init) === "Bearer access-1") {
        if (p === "/slow") await slowGate; // يرجع بعد أن ينتهي تجديد الطلب الأول
        return json(401, errorBody("token_expired", "انتهى التوكن"));
      }
      return json(200, { p });
    });
    const slow = client.get("/slow");
    await client.get("/fast");
    releaseSlow();
    await expect(slow).resolves.toEqual({ p: "/slow" });
    expect(refreshes).toBe(1);
  });

  test("refresh مرفوض ← مسح التوكنات وإبلاغ انتهاء الجلسة", async () => {
    const store = new MemoryStore(stored(1, 0));
    const { client, onSessionEnded } = setup(store, () =>
      json(
        401,
        errorBody("refresh_invalid", "انتهت الجلسة. سجّل الدخول من جديد"),
      ),
    );
    const error = await client.get("/me").catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "refresh_invalid",
      message: "انتهت الجلسة. سجّل الدخول من جديد",
    });
    expect(store.value).toBeNull();
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
  });

  test("جلسة ملغاة (خروج من كل الأجهزة) ← مسح وإبلاغ", async () => {
    const store = new MemoryStore(stored(1));
    const { client, onSessionEnded } = setup(store, () =>
      json(401, errorBody("session_revoked", "تم تسجيل الخروج من هذا الهاتف")),
    );
    await expect(client.get("/me")).rejects.toMatchObject({
      isSessionEnded: true,
    });
    expect(store.clear).toHaveBeenCalled();
    expect(onSessionEnded).toHaveBeenCalled();
    expect(await client.hasSession()).toBe(false);
  });

  test("خطة أقل ← onPlanBlocked بالتفاصيل، والتوكنات تبقى", async () => {
    const store = new MemoryStore(stored(1));
    const details = { current_plan: "pro", required_plan: "enterprise" };
    const { client, onPlanBlocked, onSessionEnded } = setup(store, () =>
      json(
        403,
        errorBody(
          "plan_upgrade_required",
          "تطبيق الهاتف متاح في خطة «سلسلة» فقط",
          details,
        ),
      ),
    );
    const error = await client.get("/me").catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "plan_upgrade_required",
      status: 403,
      details,
      isPlanBlocked: true,
    });
    expect(onPlanBlocked).toHaveBeenCalledTimes(1);
    expect(onSessionEnded).not.toHaveBeenCalled();
    expect(store.value).not.toBeNull();
  });

  test("بلا إنترنت ← رسالة عربية والتوكنات تبقى (حتى أثناء التجديد)", async () => {
    const store = new MemoryStore(stored(1, 0));
    const { client, onSessionEnded } = setup(store, () => {
      throw new TypeError("Network request failed");
    });
    const error = await client.get("/me").catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "network",
      message: NETWORK_MESSAGE,
      isOffline: true,
      status: 0,
    });
    expect(store.value).not.toBeNull();
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  test("الخادم لا يرد ← مهلة", async () => {
    const store = new MemoryStore(stored(1));
    const { client } = setup(
      store,
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
      { timeoutMs: 20 },
    );
    await expect(client.get("/me")).rejects.toMatchObject({
      code: "timeout",
      message: TIMEOUT_MESSAGE,
      isOffline: true,
    });
  });

  test("خطأ 500 ← رسالة عامة بلا تفاصيل داخلية", async () => {
    const store = new MemoryStore(stored(1));
    const { client } = setup(store, () =>
      json(500, { error: { code: "server_error", message: "Traceback ..." } }),
    );
    await expect(client.get("/me")).rejects.toMatchObject({
      code: "server_error",
      message: SERVER_MESSAGE,
      status: 500,
    });
  });

  test("رد غير JSON (بوابة/بروكسي) ← رسالة عامة", async () => {
    const store = new MemoryStore(stored(1));
    const { client } = setup(
      store,
      () => new Response("<html>Bad Gateway</html>", { status: 502 }),
    );
    await expect(client.get("/me")).rejects.toMatchObject({
      message: SERVER_MESSAGE,
      status: 502,
    });
  });

  test("رسالة الخادم العربية تُعرض كما هي (مثل حد المحاولات)", async () => {
    const store = new MemoryStore(null);
    const { client } = setup(store, () =>
      json(
        429,
        errorBody("rate_limited", "محاولات كثيرة. انتظر دقيقة وحاول مرة أخرى", {
          retry_after: 30,
        }),
      ),
    );
    const input = {
      code: "AAAA-BBBB-CCCC",
      username: "owner",
      password: "x",
      device_id: "dev-0001",
      device_name: "Pixel",
      platform: "android" as const,
    };
    await expect(client.login(input)).rejects.toMatchObject({
      code: "rate_limited",
      message: "محاولات كثيرة. انتظر دقيقة وحاول مرة أخرى",
      details: { retry_after: 30 },
    });
  });

  test("الدخول يحفظ التوكنات، وخطأ الخطة عند الدخول لا يفتح شاشة الترقية (يظهر في النموذج)", async () => {
    const store = new MemoryStore(null);
    let planned = false;
    const { client, onPlanBlocked } = setup(store, (url, init) => {
      expect(path(url)).toBe("/auth/login");
      expect(auth(init)).toBeUndefined();
      if (planned)
        return json(403, errorBody("plan_upgrade_required", "رقِّ الخطة"));
      return json(200, tokensOut(1));
    });
    const input = {
      code: "AAAA-BBBB-CCCC",
      username: "owner",
      password: "pw",
      device_id: "dev-0001",
      device_name: "Pixel",
      platform: "android" as const,
    };
    await client.login(input);
    expect(store.value).toEqual(stored(1));
    planned = true;
    await expect(client.login(input)).rejects.toMatchObject({
      code: "plan_upgrade_required",
    });
    expect(onPlanBlocked).not.toHaveBeenCalled();
  });

  test("الخروج يمسح التوكنات حتى بدون إنترنت", async () => {
    const store = new MemoryStore(stored(1));
    const { client } = setup(store, () => {
      throw new TypeError("Network request failed");
    });
    await expect(client.logout()).resolves.toBe(false);
    expect(store.value).toBeNull();
  });

  test("الخروج من كل الأجهزة يفشل بدون إنترنت ويُبقي الهاتف مسجلاً", async () => {
    const store = new MemoryStore(stored(1));
    const { client } = setup(store, () => {
      throw new TypeError("Network request failed");
    });
    await expect(client.logoutAll()).rejects.toMatchObject({ code: "network" });
    expect(store.value).not.toBeNull();
  });

  test("الخروج من كل الأجهزة ينجح ويمسح", async () => {
    const store = new MemoryStore(stored(1));
    const { client } = setup(store, (url) => {
      expect(path(url)).toBe("/auth/logout-all");
      return json(200, { revoked: 3 });
    });
    await expect(client.logoutAll()).resolves.toBe(3);
    expect(store.value).toBeNull();
  });

  test("بدون عنوان خادم ← رسالة واضحة", async () => {
    const store = new MemoryStore(stored(1));
    const { client, fetchMock } = setup(store, () => json(200, {}), {
      baseUrl: () => "  ",
    });
    await expect(client.get("/me")).rejects.toMatchObject({
      code: "no_server",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("بدون جلسة محفوظة ← unauthorized بلا طلب", async () => {
    const store = new MemoryStore(null);
    const { client, fetchMock, onSessionEnded } = setup(store, () =>
      json(200, {}),
    );
    await expect(client.get("/me")).rejects.toMatchObject({
      code: "unauthorized",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSessionEnded).not.toHaveBeenCalled(); // لم تكن هناك جلسة أصلاً
  });
});
