import { invoke, isTauri } from "@tauri-apps/api/core";

export interface SavedFile {
  /** الاسم الفعلي بعد الحفظ (قد يصبح "products (1).xlsx" لو الاسم موجود). */
  fileName: string;
  /** المسار الكامل داخل Tauri، وnull في المتصفح (المتصفح لا يكشف المسار). */
  path: string | null;
}

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

function browserDownload(bytes: Uint8Array, fileName: string, mime: string) {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // مهلة قصيرة حتى يبدأ المتصفح التنزيل قبل تحرير الرابط.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * يحفظ ملفاً في مجلد التنزيلات.
 * - داخل Tauri: Rust يكتب الملف ويرجّع مساره، فالنجاح مؤكد فعلاً (أمر save_download).
 * - في المتصفح: تنزيل عادي.
 */
export async function saveFile(
  bytes: Uint8Array,
  fileName: string,
  mime = "application/octet-stream",
): Promise<SavedFile> {
  if (isTauri()) {
    const path = await invoke<string>("save_download", bytes, {
      headers: { "x-file-name": encodeURIComponent(fileName) },
    });
    return { fileName: baseName(path), path };
  }
  browserDownload(bytes, fileName, mime);
  return { fileName, path: null };
}

/** يفتح مستكشف الملفات على ملف محفوظ (Tauri فقط). */
export async function revealFile(path: string) {
  await invoke("reveal_download", { path });
}
