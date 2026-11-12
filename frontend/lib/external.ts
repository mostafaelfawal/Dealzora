import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * يفتح رابطاً خارجياً في المتصفح/البرنامج الافتراضي.
 * داخل Tauri الـ WebView مابيفتحش target="_blank" ولا window.open، فبنمر عبر Rust (open_external)
 * اللي بيقبل روابط من قائمة بيضاء فقط + tel:.
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) await invoke("open_external", { url });
  else if (url.startsWith("tel:")) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}
