import { IconBuildingStore } from "@tabler/icons-react";

/** العنوان الأساسي بلا رابط متجر: لا قائمة متاجر (خصوصية المحلات)، فقط تعريف قصير. */
export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center bg-primary text-primary-foreground">
          <IconBuildingStore className="size-7" />
        </span>
        <h1 className="text-xl font-bold">متاجر Dealzora</h1>
        <p className="text-sm text-muted-foreground">
          افتح رابط المتجر الذي أرسله لك المحل، مثل:
          <span dir="ltr" className="mt-1 block font-mono text-foreground">
            /super-market-elbaraka
          </span>
        </p>
      </div>
    </main>
  );
}
