"use client";

import { IconLoader2, IconPrinter, IconRefresh } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { canPrintDirect, listPrinters, printReceiptHtml } from "@/lib/print";
import {
  setPrinterPrefs,
  usePrinterPrefs,
  type PaperWidth,
  type PrintMode,
} from "@/lib/printerPrefs";

const MODES: { value: PrintMode; label: string }[] = [
  { value: "direct", label: "مباشرة على الطابعة الحرارية (بدون نافذة)" },
  { value: "dialog", label: "نافذة الطباعة العادية" },
];

const PAPERS: { value: `${PaperWidth}`; label: string }[] = [
  { value: "80", label: "80 مم (الأشهر)" },
  { value: "58", label: "58 مم (الطابعات الصغيرة)" },
];

const NO_PRINTER = "__none__";

function testReceiptHtml(paperMm: number, printer: string) {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تجربة الطباعة</title>
<style>
  @page { size: ${paperMm}mm auto; margin: 0; }
  body { width: ${paperMm - 6}mm; margin: 0 auto; padding: 3mm 0; font: 12px/1.5 Tahoma, Arial, sans-serif; color: #000; }
  h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
  .c { text-align: center; } hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; }
  .big { font-size: 18px; font-weight: bold; }
</style></head><body>
  <h1>تجربة الطباعة</h1>
  <div class="c">${printer.replace(/[&<>"']/g, "")}</div>
  <div class="c">${formatDateTime(Date.now())}</div>
  <hr>
  <div class="row"><span>نص عربي عادي</span><span>123.50</span></div>
  <div class="row"><b>نص عريض</b><b>9,999.00</b></div>
  <div class="row big"><span>الإجمالي</span><span>1,250.00</span></div>
  <hr>
  <div class="c">لو ظهر هذا الإيصال واضحاً فالطابعة جاهزة ✓</div>
</body></html>`;
}

export function PrinterSection() {
  const prefs = usePrinterPrefs();
  const direct = canPrintDirect();
  const [testing, setTesting] = useState(false);

  const printers = useQuery({
    queryKey: ["local-printers"],
    queryFn: listPrinters,
    enabled: direct,
    staleTime: 60_000,
  });

  if (!direct) {
    return (
      <p className="text-sm text-muted-foreground">
        الطباعة المباشرة متاحة في برنامج Dealzora على ويندوز فقط. من المتصفح
        تُستخدم نافذة الطباعة العادية.
      </p>
    );
  }

  const list = printers.data ?? [];
  const missing =
    prefs.printer !== null && !list.some((p) => p.name === prefs.printer);
  const printerItems = [
    { value: NO_PRINTER, label: "— اختر الطابعة —" },
    ...list.map((p) => ({
      value: p.name,
      label: p.is_default ? `${p.name} (الافتراضية)` : p.name,
    })),
    ...(missing && prefs.printer
      ? [{ value: prefs.printer, label: `${prefs.printer} (غير موصّلة)` }]
      : []),
  ];
  const isDirect = prefs.mode === "direct";

  async function testPrint() {
    if (!prefs.printer) return;
    setTesting(true);
    try {
      await printReceiptHtml(testReceiptHtml(prefs.paperMm, prefs.printer), {
        jobName: "تجربة الطباعة",
        openDrawer: true,
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>طريقة الطباعة</Label>
        <OptionSelect
          label="طريقة الطباعة"
          items={MODES}
          value={prefs.mode}
          onChange={(mode) => setPrinterPrefs({ mode })}
          className="max-w-sm"
        />
        <p className="text-[11px] text-muted-foreground">
          المباشرة تعمل مع طابعات الإيصالات الحرارية (ESC/POS) مثل Xprinter
          وEpson وRongta. لو الطابعة عادية (A4) اختر نافذة الطباعة.
        </p>
      </div>

      {isDirect && (
        <>
          <div className="space-y-1.5">
            <Label>طابعة الإيصالات</Label>
            <div className="flex max-w-xl items-center gap-2">
              <OptionSelect
                label="طابعة الإيصالات"
                items={printerItems}
                value={prefs.printer ?? NO_PRINTER}
                onChange={(value) =>
                  setPrinterPrefs({
                    printer: value === NO_PRINTER ? null : value,
                  })
                }
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="تحديث قائمة الطابعات"
                title="تحديث قائمة الطابعات"
                onClick={() => printers.refetch()}
                disabled={printers.isFetching}
              >
                {printers.isFetching ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconRefresh className="size-4" />
                )}
              </Button>
            </div>
            {printers.isError && (
              <p className="text-[11px] text-destructive">
                {extractErrorMessage(printers.error, "تعذّر قراءة الطابعات")}
              </p>
            )}
            {missing && (
              <p className="text-[11px] text-destructive">
                الطابعة المختارة غير موجودة الآن. تأكد من توصيلها وتشغيلها.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>عرض الورق</Label>
            <OptionSelect
              label="عرض الورق"
              items={PAPERS}
              value={`${prefs.paperMm}`}
              onChange={(v) =>
                setPrinterPrefs({ paperMm: Number(v) as PaperWidth })
              }
              className="max-w-xs"
            />
          </div>

          <div className="flex max-w-xl items-center justify-between gap-3">
            <Label htmlFor="printer-cut" className="flex-1">
              قص الورق تلقائياً بعد كل إيصال
            </Label>
            <Switch
              id="printer-cut"
              checked={prefs.cut}
              onCheckedChange={(cut) => setPrinterPrefs({ cut })}
            />
          </div>

          <div className="flex max-w-xl items-center justify-between gap-3">
            <Label htmlFor="printer-drawer" className="flex-1">
              فتح درج النقود مع البيع النقدي ورد المرتجع نقداً
              <span className="block text-[11px] font-normal text-muted-foreground">
                للدرج الموصّل بالطابعة بكابل RJ11.
              </span>
            </Label>
            <Switch
              id="printer-drawer"
              checked={prefs.openDrawer}
              onCheckedChange={(openDrawer) => setPrinterPrefs({ openDrawer })}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={testPrint}
            disabled={!prefs.printer || testing}
            className="gap-2"
          >
            {testing ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconPrinter className="size-4" />
            )}
            طباعة صفحة تجربة
          </Button>
        </>
      )}

      <p className="text-[11px] text-muted-foreground">
        تُحفظ هذه الإعدادات على هذا الجهاز فقط، لأن كل جهاز كاشير موصّل بطابعته.
      </p>
    </div>
  );
}
