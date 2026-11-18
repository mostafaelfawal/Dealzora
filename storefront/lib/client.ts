"use client";

import type { ApiErrorBody } from "./types";

/** طلبات المتصفح: نفس العنوان (/v1/store/public/…) فلا CORS ولا نطاق آخر. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> | null,
  ) {
    super(message);
  }
}

const NETWORK = "تعذّر الاتصال. تأكد من الإنترنت وحاول مرة أخرى";

export async function storeApi<T>(
  slug: string,
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/v1/store/public/${slug}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(init?.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init?.signal,
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "network", NETWORK, null);
  }
  if (res.ok) return (await res.json()) as T;
  let body: ApiErrorBody = {};
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    /* رد غير JSON */
  }
  const err = body.error ?? {};
  let message = err.message ?? "حدث خطأ غير متوقع. حاول مرة أخرى";
  if (
    err.code === "validation_error" &&
    Array.isArray(err.details) &&
    err.details[0]
  ) {
    const msg = String((err.details[0] as { msg?: string }).msg ?? "").replace(
      /^Value error,\s*/i,
      "",
    );
    if (msg) message = msg;
  }
  const details =
    err.details && typeof err.details === "object" && !Array.isArray(err.details)
      ? (err.details as Record<string, unknown>)
      : null;
  throw new ApiError(
    res.status,
    err.code ?? `http_${res.status}`,
    message,
    details,
  );
}

export function newClientRef(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`;
}
