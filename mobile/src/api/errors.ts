/**
 * أخطاء الـ API برسائل عربية للمستخدم.
 *
 * - رسائل الخادم عربية أصلاً: نعرضها كما هي.
 * - أخطاء الشبكة والمهلة والخادم غير المتاح لها رسائل ثابتة هنا.
 * - code يحدد التصرف (انتهاء الجلسة، شاشة الترقية…) لا الرسالة.
 */
import type { ServerErrorBody } from "./types";

export const NETWORK_MESSAGE = "لا يوجد اتصال بالإنترنت. تأكد من الشبكة وحاول مرة أخرى";
export const TIMEOUT_MESSAGE = "الخادم لا يستجيب. تأكد من الإنترنت وحاول مرة أخرى";
export const SERVER_MESSAGE = "حدث خطأ في الخادم. حاول بعد قليل";
export const FALLBACK_MESSAGE = "حدث خطأ غير متوقع. حاول مرة أخرى";
export const SESSION_ENDED_MESSAGE = "انتهت الجلسة. سجّل الدخول من جديد";
export const NO_SERVER_MESSAGE = "اكتب عنوان خادم المزامنة أولاً";

/** أكواد تعني أن الجلسة انتهت نهائياً: نمسح التوكنات ونرجع لشاشة الدخول. */
export const SESSION_ENDED_CODES: ReadonlySet<string> = new Set([
  "session_revoked",
  "refresh_invalid",
  "refresh_expired",
  "token_invalid",
  "unauthorized",
]);

export const PLAN_CODE = "plan_upgrade_required";

export class ApiError extends Error {
  constructor(
    /** كود الخادم، أو network / timeout / server_error / bad_response / no_server محلياً. */
    readonly code: string,
    message: string,
    /** 0 = لم يصل رد من الخادم. */
    readonly status: number = 0,
    readonly details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** لا اتصال (الشبكة أو المهلة): نعرض آخر بيانات محفوظة بدل الخطأ. */
  get isOffline(): boolean {
    return this.code === "network" || this.code === "timeout";
  }

  get isSessionEnded(): boolean {
    return SESSION_ENDED_CODES.has(this.code);
  }

  get isPlanBlocked(): boolean {
    return this.code === PLAN_CODE;
  }
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** يحوّل رد خطأ من الخادم إلى ApiError. */
export function fromResponse(status: number, body: unknown): ApiError {
  const err = (body as ServerErrorBody | null)?.error;
  const code = text(err?.code) ?? (status >= 500 ? "server_error" : `http_${status}`);
  if (status >= 500) {
    // لا نعرض تفاصيل داخلية، والخادم يرد أصلاً برسالة عامة.
    return new ApiError(code, SERVER_MESSAGE, status);
  }
  const message = text(err?.message) ?? FALLBACK_MESSAGE;
  return new ApiError(code, message, status, err?.details ?? null);
}

/** رسالة لأي خطأ (للـ onError في useMutation وغيرها). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return FALLBACK_MESSAGE;
}
