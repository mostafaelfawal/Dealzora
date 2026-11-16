import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { useSyncExternalStore } from "react";

/**
 * التحديث التلقائي (Rust: src-tauri/src/updater.rs). حالة واحدة مشتركة بين
 * التنبيه عند فتح البرنامج وقسم «تحديث البرنامج» في الإعدادات.
 */
export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes: string | null;
  date: string | null;
}

type DownloadEvent =
  | { event: "started"; data: { contentLength: number | null } }
  | { event: "progress"; data: { chunkLength: number } }
  | { event: "finished" };

export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "latest"; checkedAt: number }
  | { status: "available"; update: UpdateInfo }
  | {
      status: "downloading";
      update: UpdateInfo;
      downloaded: number;
      total: number | null;
    }
  | { status: "installing"; update: UpdateInfo }
  | { status: "error"; message: string; update?: UpdateInfo };

let state: UpdateState = { status: "idle" };
const listeners = new Set<() => void>();

function set(next: UpdateState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export const updatesSupported = () => isTauri();

let versionPromise: Promise<string | null> | null = null;
/** نسخة البرنامج المثبّتة (null خارج تطبيق سطح المكتب). */
export function appVersion(): Promise<string | null> {
  versionPromise ??= isTauri()
    ? getVersion().catch(() => null)
    : Promise.resolve(null);
  return versionPromise;
}

/** يفحص GitHub عن نسخة أحدث. `silent`: الأخطاء لا تُعرض (فحص الخلفية بلا إنترنت مثلاً). */
export async function checkForUpdate({
  silent = false,
}: { silent?: boolean } = {}): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  // لا نقاطع تحميلاً أو تثبيتاً جارياً.
  if (state.status === "downloading" || state.status === "installing")
    return null;
  const before = state;
  set({ status: "checking" });
  try {
    const update = await invoke<UpdateInfo | null>("check_update");
    set(
      update
        ? { status: "available", update }
        : { status: "latest", checkedAt: Date.now() },
    );
    return update;
  } catch (e) {
    if (silent) set(before.status === "checking" ? { status: "idle" } : before);
    else set({ status: "error", message: updateErrorMessage(e) });
    return null;
  }
}

/** ينزّل التحديث ثم يثبّته: البرنامج يُغلق ويُفتح بالنسخة الجديدة تلقائياً. */
export async function installUpdate(): Promise<void> {
  if (state.status !== "available" && state.status !== "error") return;
  const update = state.update;
  if (!update) return;

  set({ status: "downloading", update, downloaded: 0, total: null });
  const onEvent = new Channel<DownloadEvent>();
  onEvent.onmessage = (msg) => {
    if (state.status !== "downloading") return;
    if (msg.event === "started")
      set({ ...state, total: msg.data.contentLength });
    else if (msg.event === "progress")
      set({ ...state, downloaded: state.downloaded + msg.data.chunkLength });
    else set({ status: "installing", update });
  };

  try {
    await invoke("install_update", { onEvent });
  } catch (e) {
    set({ status: "error", message: updateErrorMessage(e), update });
    // التحديث المعلّق استُهلك في Rust: نفحص من جديد ليصبح «حاول مرة أخرى» ممكناً.
    await checkForUpdate({ silent: true });
    if (state.status === "available")
      set({ status: "error", message: updateErrorMessage(e), update });
  }
}

function updateErrorMessage(e: unknown): string {
  const raw = String(e ?? "");
  if (/signature/i.test(raw))
    return "ملف التحديث غير موثوق (التوقيع غير مطابق)، فلم يُثبَّت.";
  if (/network|dns|connect|timed? ?out|request|offline/i.test(raw))
    return "تعذّر الاتصال بالإنترنت. تأكد من الاتصال وحاول مرة أخرى.";
  return "تعذّر التحديث الآن. حاول مرة أخرى بعد قليل.";
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
