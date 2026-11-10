import { isTauri } from "@tauri-apps/api/core";

/** هل تتوفر نافذة اختيار الملفات الأصلية؟ (تطبيق سطح المكتب فقط، لا المتصفح أثناء التطوير). */
export const canPickPath = () => isTauri();

/** نافذة اختيار مجلد. null = ألغى المستخدم أو خارج تطبيق سطح المكتب. */
export async function pickFolder(defaultPath?: string): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({
    directory: true,
    multiple: false,
    defaultPath,
    title: "اختر مجلد النسخ الاحتياطي",
  });
  return typeof picked === "string" ? picked : null;
}

/** نافذة اختيار ملف نسخة احتياطية (.db). */
export async function pickBackupFile(
  defaultPath?: string,
): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({
    directory: false,
    multiple: false,
    defaultPath,
    title: "اختر ملف النسخة الاحتياطية",
    filters: [{ name: "نسخة Dealzora", extensions: ["db"] }],
  });
  return typeof picked === "string" ? picked : null;
}
