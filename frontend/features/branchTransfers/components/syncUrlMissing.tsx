import { IconAlertTriangle } from "@tabler/icons-react";

/** نسخة بُنيت بدون عنوان سيرفر الفروع (NEXT_PUBLIC_SYNC_URL): خطأ في البناء، لا في إعدادات التاجر. */
export function SyncUrlMissing() {
  return (
    <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
      عنوان سيرفر الفروع غير مضبوط في هذه النسخة من البرنامج. تواصل مع الدعم.
    </p>
  );
}
