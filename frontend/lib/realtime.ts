"use client";

import { useSyncExternalStore } from "react";

import { getReadTarget, reportStreamStatus } from "./axios";

/**
 * مزامنة لحظية: اتصال SSE واحد مع الجهاز الأساسي (GET /events).
 * السيرفر يعلن أسماء المواضيع التي تغيّرت بعد كل commit، والواجهة تعيد جلب ما يخصها فقط.
 * (fetch بدل EventSource لأن EventSource لا يرسل هيدرات الهوية.)
 */

export type RealtimeTopic =
  | "products"
  | "customers"
  | "sales"
  | "held"
  | "shifts"
  | "treasury"
  | "expenses"
  | "purchases"
  | "suppliers"
  | "users"
  | "settings"
  | "devices";

/** يُطلق على window مع detail: المواضيع. "*" = اتصال رجع بعد انقطاع (قد تكون فاتتنا تغييرات). */
export const REALTIME_EVENT = "dz:realtime";
export type RealtimeDetail = RealtimeTopic[] | "*";

const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 15_000;
/** السيرفر يرسل نبضة كل 15 ثانية: صمت أطول من هذا = الاتصال ميت. */
const SILENCE_MS = 35_000;

// ---------- حالة الاتصال (للتحكم في الـ polling الاحتياطي) ----------
let connected = false;
const listeners = new Set<() => void>();

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  listeners.forEach((fn) => fn());
}

export const isRealtimeConnected = () => connected;

/** true طالما البث اللحظي شغال: الـ polling يتوقف أو يبطئ. */
export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => connected,
    () => false,
  );
}

/** interval الـ polling: متوقف مع البث اللحظي، والقيمة الأصلية كاحتياط عند انقطاعه. */
export function useFallbackInterval(ms: number): number | false {
  return useRealtimeConnected() ? false : ms;
}

function emit(detail: RealtimeDetail) {
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail }));
}

/** يستمع لتغييرات مواضيع معيّنة. يرجع دالة الإلغاء. */
export function onRealtime(
  topics: RealtimeTopic[] | "*",
  handler: () => void,
): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<RealtimeDetail>).detail;
    if (
      detail === "*" ||
      topics === "*" ||
      detail.some((t) => topics.includes(t))
    )
      handler();
  };
  window.addEventListener(REALTIME_EVENT, listener);
  return () => window.removeEventListener(REALTIME_EVENT, listener);
}

// ---------- الاتصال ----------

/** يفتح البث ويعيد الاتصال تلقائياً. يرجع دالة الإيقاف. */
export function startRealtime(): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryMs = RETRY_MIN_MS;
  let everConnected = false;

  async function connect() {
    if (stopped) return;
    controller = new AbortController();
    const ctl = controller;
    let silence: ReturnType<typeof setTimeout> | undefined;
    const resetSilence = () => {
      clearTimeout(silence);
      silence = setTimeout(() => ctl.abort(), SILENCE_MS);
    };

    try {
      const { baseURL, headers } = await getReadTarget();
      if (!headers.Authorization) throw new Error("no_session");
      resetSilence();
      const res = await fetch(`${baseURL}/events`, {
        headers: { ...headers, Accept: "text/event-stream" },
        signal: ctl.signal,
        cache: "no-store",
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        reportStreamStatus(res.status, body);
        if (res.status === 401) {
          stopped = true; // انتهت الجلسة/أُلغي الاقتران: الشاشات المختصة تتولى
          return;
        }
        throw new Error(`events_${res.status}`);
      }

      reportStreamStatus(200);
      setConnected(true);
      retryMs = RETRY_MIN_MS;
      if (everConnected) emit("*"); // رجع بعد انقطاع: نحدّث كل شيء مرة
      everConnected = true;

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        resetSilence();
        buffer += value;
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          handleBlock(block);
        }
      }
    } catch {
      // شبكة/الجهاز الأساسي مغلق/صمت طويل: نعيد المحاولة.
    } finally {
      clearTimeout(silence);
      setConnected(false);
    }

    if (stopped) return;
    retryTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  }

  function handleBlock(block: string) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (event === "change") {
      try {
        const topics = (JSON.parse(data) as { topics: RealtimeTopic[] }).topics;
        if (topics.length) emit(topics);
      } catch {
        // تجاهل رسالة تالفة.
      }
    } else if (event === "unauthorized") {
      // الجلسة انتهت أثناء البث: أي طلب عادي سيكتشفها ويعيد لشاشة الدخول.
      reportStreamStatus(401, { error: { code: "unauthorized" } });
      stopped = true;
    }
  }

  void connect();
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    controller?.abort();
    setConnected(false);
  };
}
