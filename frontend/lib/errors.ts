import { isAxiosError } from "axios";

const FALLBACK = "حدث خطأ غير متوقع. حاول مرة أخرى";
const NETWORK = "تعذّر الاتصال بالسيرفر. تأكد من الإنترنت وحاول مجدداً";

type Body = {
  message?: unknown;
  error?: unknown;
  detail?: unknown;
};

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function readBody(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === "string") return data.length < 200 ? asText(data) : null;
  if (typeof data !== "object") return null;

  const body = data as Body;
  const direct = asText(body.message);
  if (direct) return direct;

  // { error: "..." } أو { error: { message: "..." } }
  const err = body.error;
  if (typeof err === "string") return asText(err);
  if (err && typeof err === "object") {
    const nested = asText((err as Body).message);
    if (nested) return nested;
  }

  // FastAPI: { detail: "..." } أو { detail: [{ msg }] } (أخطاء الـ schema)
  if (typeof body.detail === "string") return asText(body.detail);
  if (Array.isArray(body.detail)) {
    const messages = body.detail
      .map((item) => asText((item as { msg?: unknown })?.msg))
      .filter((msg): msg is string => Boolean(msg))
      .map((msg) => msg.replace(/^Value error,\s*/i, ""));
    if (messages.length) return messages.join("، ");
  }
  return null;
}

/** يستخرج رسالة مناسبة للمستخدم من أي error. تُستخدم في onError لـ useMutation. */
export function extractErrorMessage(
  error: unknown,
  fallback: string = FALLBACK,
): string {
  if (isAxiosError(error)) {
    if (!error.response) return NETWORK;
    return readBody(error.response.data) ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}