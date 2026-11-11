import { toMs, toMsOrNull } from "@/lib/apiMap";
import { api } from "@/lib/axios";

/* ---------- قبل الاقتران (بدون توكن، عنوان الجهاز الأساسي يكتبه المستخدم) ---------- */

const PAIR_TIMEOUT_MS = 8000;

async function rawFetch(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAIR_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** يتأكد أن العنوان لجهاز Dealzora أساسي يعمل. */
export async function helloMain(mainUrl: string): Promise<boolean> {
  try {
    const res = await rawFetch(`${mainUrl}/api/v1/devices/hello`);
    return res.ok && (await res.json()).app === "dealzora";
  } catch {
    return false;
  }
}

export interface PairResult {
  device_id: string;
  device_token: string;
  name: string;
}

export class PairError extends Error {}

export async function pairWithMain(
  mainUrl: string,
  code: string,
  name: string,
): Promise<PairResult> {
  let res: Response;
  try {
    res = await rawFetch(`${mainUrl}/api/v1/devices/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name }),
    });
  } catch {
    throw new PairError(
      "تعذّر الوصول للجهاز الأساسي. تأكد من العنوان وأن الجهازين على نفس الشبكة",
    );
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new PairError(
      body?.error?.message ??
        (res.status === 422
          ? "تأكد من الكود (6 أرقام) واسم الجهاز"
          : "تعذّر الاقتران"),
    );
  }
  return body as PairResult;
}

/* ---------- بعد الاقتران / الجهاز الأساسي ---------- */

export interface PairedDevice {
  id: string;
  name: string;
  lastSeenAt: number | null;
  online: boolean;
  pairedAt: number;
}

export interface NetworkInfo {
  lanEnabled: boolean;
  addresses: string[];
  port: number;
  /** null = الترخيص لم يُقرأ بعد. */
  maxTerminals: number | null;
  pairingExpiresAt: number | null;
  devices: PairedDevice[];
}

interface NetworkDto {
  lan_enabled: boolean;
  addresses: string[];
  port: number;
  max_terminals: number | null;
  pairing_expires_at: string | null;
  devices: {
    id: string;
    name: string;
    last_seen_at: string | null;
    online: boolean;
    paired_at: string;
  }[];
}

export const fetchNetwork = async (): Promise<NetworkInfo> => {
  const { data } = await api.get<NetworkDto>("/devices");
  return {
    lanEnabled: data.lan_enabled,
    addresses: data.addresses,
    port: data.port,
    maxTerminals: data.max_terminals,
    pairingExpiresAt: toMsOrNull(data.pairing_expires_at),
    devices: data.devices.map((d) => ({
      id: d.id,
      name: d.name,
      lastSeenAt: toMsOrNull(d.last_seen_at),
      online: d.online,
      pairedAt: toMs(d.paired_at),
    })),
  };
};

export const createPairingCode = async (): Promise<{
  code: string;
  expiresAt: number;
}> => {
  const { data } = await api.post<{ code: string; expires_at: string }>(
    "/devices/pairing-code",
  );
  return { code: data.code, expiresAt: toMs(data.expires_at) };
};

export const revokeDevice = async (id: string) => {
  await api.delete(`/devices/${id}`);
};

export const sendLease = async (lease: string) => {
  await api.post("/devices/lease", { lease });
};

/** فحص خفيف للاتصال بالجهاز الأساسي (جهاز الكاشير). */
export const pingMain = async () => {
  await api.get("/devices/me", { timeout: 5000 });
};
