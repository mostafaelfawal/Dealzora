/**
 * عميل API واحد لخادم المزامنة (مسارات الهاتف فقط).
 *
 * - يرفق توكن الوصول، ويجدده قبل انتهائه أو عند `token_expired` ثم يعيد الطلب مرة واحدة.
 * - تجديد واحد في نفس الوقت (single-flight): الطلبات المتزامنة تنتظر نفس التجديد.
 *   مهم لأن الخادم يعتبر refresh قديم رجع = تسريب ويلغي الجلسة كلها.
 * - انتهاء الجلسة نهائياً (إلغاء، خروج من كل الأجهزة، تغيير كلمة المرور) ← مسح التوكنات + onSessionEnded.
 * - خطة أقل من «سلسلة» ← onPlanBlocked (التوكنات تبقى: الترقية تعيد التطبيق للعمل).
 * - انقطاع الإنترنت أو المهلة ← ApiError(network/timeout) والتوكنات تبقى كما هي.
 * - لا يطبع أي توكن أو كلمة مرور أبداً.
 *
 * لا يستورد أي وحدة native: التخزين والعنوان يُمرَّران من الخارج (وتُختبر هنا بسهولة).
 */
import {
  ApiError,
  FALLBACK_MESSAGE,
  NETWORK_MESSAGE,
  NO_SERVER_MESSAGE,
  SERVER_MESSAGE,
  SESSION_ENDED_MESSAGE,
  TIMEOUT_MESSAGE,
  fromResponse,
} from "./errors";
import type { LoginInput, MobileTokens, MobileUser, StoredTokens } from "./types";
import { MOBILE_PREFIX, normalizeServerUrl } from "./url";

export interface TokenStore {
  load(): Promise<StoredTokens | null>;
  save(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
}

export interface ApiClientOptions {
  baseUrl: () => string | null | Promise<string | null>;
  tokens: TokenStore;
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  onSessionEnded?: (error: ApiError) => void;
  onPlanBlocked?: (error: ApiError) => void;
  /** بيانات المستخدم من آخر دخول/تجديد (الصلاحيات قد تتغير على الخادم). */
  onUser?: (user: MobileUser) => void;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** false = طلب بدون توكن (الدخول). */
  auth?: boolean;
  signal?: AbortSignal;
}

/** نجدد قبل الانتهاء بهامش (فرق ساعة الهاتف عن الخادم + زمن الطلب). */
const EXPIRY_SKEW_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 15_000;

const unauthorized = () => new ApiError("unauthorized", SESSION_ENDED_MESSAGE, 401);

export class ApiClient {
  /** undefined = لم تُقرأ من التخزين بعد. */
  private cached: StoredTokens | null | undefined = undefined;
  private refreshing: Promise<StoredTokens> | null = null;

  constructor(private readonly opts: ApiClientOptions) {}

  // ================= عام =================
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      return await this.attempt<T>(path, options);
    } catch (error) {
      throw await this.handle(error, options.auth !== false);
    }
  }

  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { signal });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  async hasSession(): Promise<boolean> {
    return (await this.loadTokens()) !== null;
  }

  async login(input: LoginInput): Promise<MobileTokens> {
    const out = await this.request<MobileTokens>("/auth/login", { method: "POST", body: input, auth: false });
    await this.store(out);
    return out;
  }

  /**
   * خروج هذا الهاتف. التوكنات تُمسح محلياً دائماً، حتى بدون إنترنت.
   * @returns false لو لم يصل الطلب للخادم (الجلسة هناك تنتهي وحدها بعد مدة الـ refresh).
   */
  async logout(): Promise<boolean> {
    try {
      await this.request<void>("/auth/logout", { method: "POST" });
      return true;
    } catch (error) {
      // جلسة منتهية أصلاً = خرجنا فعلاً.
      return error instanceof ApiError && error.isSessionEnded;
    } finally {
      await this.clearTokens();
    }
  }

  /** الخروج من كل الأجهزة: لازم يصل للخادم (وإلا يفشل والهاتف يبقى مسجلاً). */
  async logoutAll(): Promise<number> {
    const out = await this.request<{ revoked: number }>("/auth/logout-all", { method: "POST" });
    await this.clearTokens();
    return out.revoked;
  }

  async clearTokens(): Promise<void> {
    this.cached = null;
    await this.opts.tokens.clear();
  }

  // ================= التوكنات =================
  private async loadTokens(): Promise<StoredTokens | null> {
    if (this.cached === undefined) this.cached = await this.opts.tokens.load();
    return this.cached;
  }

  private async store(out: MobileTokens): Promise<StoredTokens> {
    const tokens: StoredTokens = {
      access_token: out.access_token,
      expires_at: out.expires_at,
      refresh_token: out.refresh_token,
      session_id: out.session_id,
    };
    // نحفظ قبل أي طلب آخر: الـ refresh القديم صار مرفوضاً على الخادم.
    await this.opts.tokens.save(tokens);
    this.cached = tokens;
    this.opts.onUser?.(out.user);
    return tokens;
  }

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private async freshTokens(): Promise<StoredTokens> {
    const tokens = await this.loadTokens();
    if (!tokens) throw unauthorized();
    const expires = Date.parse(tokens.expires_at);
    if (Number.isNaN(expires) || expires - EXPIRY_SKEW_MS <= this.now()) return this.refresh();
    return tokens;
  }

  private refresh(): Promise<StoredTokens> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<StoredTokens> {
    const tokens = await this.loadTokens();
    if (!tokens) throw unauthorized();
    const out = await this.send<MobileTokens>("/auth/refresh", {
      method: "POST",
      body: { refresh_token: tokens.refresh_token },
    }, null);
    return this.store(out);
  }

  // ================= الطلب =================
  private async attempt<T>(path: string, options: RequestOptions): Promise<T> {
    if (options.auth === false) return this.send<T>(path, options, null);
    const tokens = await this.freshTokens();
    try {
      return await this.send<T>(path, options, tokens.access_token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "token_expired") throw error;
      // طلب آخر جدّد بالفعل؟ نستخدم توكنه بدل تجديد ثانٍ.
      const current = await this.loadTokens();
      const next =
        current && current.access_token !== tokens.access_token ? current : await this.refresh();
      return this.send<T>(path, options, next.access_token); // مرة واحدة فقط (لا حلقة)
    }
  }

  private async handle(error: unknown, authed: boolean): Promise<ApiError> {
    const apiError =
      error instanceof ApiError ? error : new ApiError("unknown", FALLBACK_MESSAGE);
    if (!authed) return apiError;
    if (apiError.isSessionEnded) {
      const had = (await this.loadTokens()) !== null;
      await this.clearTokens();
      if (had) this.opts.onSessionEnded?.(apiError);
    } else if (apiError.isPlanBlocked) {
      this.opts.onPlanBlocked?.(apiError);
    }
    return apiError;
  }

  private async send<T>(path: string, options: RequestOptions, accessToken: string | null): Promise<T> {
    const base = normalizeServerUrl(await this.opts.baseUrl());
    if (!base) throw new ApiError("no_server", NO_SERVER_MESSAGE);

    const fetchFn = this.opts.fetch ?? fetch;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort);

    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    let response: Response;
    try {
      response = await fetchFn(`${base}${MOBILE_PREFIX}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      if (options.signal?.aborted) throw new ApiError("aborted", FALLBACK_MESSAGE);
      if (timedOut) throw new ApiError("timeout", TIMEOUT_MESSAGE);
      throw new ApiError("network", NETWORK_MESSAGE);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }

    if (response.status === 204) return undefined as T;
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw fromResponse(response.status, body);
    if (body === null) throw new ApiError("bad_response", SERVER_MESSAGE, response.status);
    return body as T;
  }
}
