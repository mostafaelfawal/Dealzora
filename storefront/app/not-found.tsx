import { IconMoodSad } from "@tabler/icons-react";

export default function NotFound() {
  return (
    <main className="flex min-h-[70dvh] items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <IconMoodSad className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">الصفحة غير موجودة</h1>
        <p className="text-sm text-muted-foreground">
          تأكد من الرابط، أو ربما لم يعد هذا المتجر أو الصنف متاحاً.
        </p>
      </div>
    </main>
  );
}
