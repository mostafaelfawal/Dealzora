"use client";

import {
  IconFileText,
  IconInfoCircle,
  IconLoader2,
  IconPrinter,
  IconReceipt,
  IconRefresh,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { buildReceiptHtml } from "@/features/sales/lib/receipt";
import { extractErrorMessage } from "@/lib/errors";
import { canPrintDirect, listPrinters, printReceiptHtml } from "@/lib/print";
import {
  setPrinterPrefs,
  usePrinterPrefs,
  type PaperWidth,
  type PrinterKind,
} from "@/lib/printerPrefs";

import { useShopName } from "../hooks/useSettings";
import { sampleSale } from "../lib/sampleReceipt";
import {
  ChoiceCards,
  SettingGroup,
  SettingRow,
  SwitchRow,
} from "./settingsControls";

const KINDS: {
  value: PrinterKind;
  title: string;
  description: string;
  icon: ReactNode;
  badge?: string;
}[] = [
  {
    value: "thermal",
    title: "طابعة إيصالات حرارية",
    description:
      "إيصال صغير على ورق رول 58 أو 80 مم. للسوبر ماركت والبقالة والصيدلية.",
    icon: <IconReceipt />,
    badge: "الأشهر",
  },
  {
    value: "a4",
    title: "طابعة عادية (A4)",
    description:
      "فاتورة كاملة بجدول وشعار على ورق A4. للجملة والتوريدات والشركات.",
    icon: <IconFileText />,
  },
];

const PAPERS = [
  { id: "80" as const, label: "80 مم (الأشهر)" },
  { id: "58" as const, label: "58 مم (صغيرة)" },
];

const NO_PRINTER = "__none__";

/** نوع الطابعة وإعداداتها على هذا الجهاز (كل جهاز كاشير موصّل بطابعته). */
export function PrinterSection() {
  const prefs = usePrinterPrefs();
  const desktop = canPrintDirect();
  const shopName = useShopName().data ?? "اسم المحل";
  const [testing, setTesting] = useState(false);

  const thermal = prefs.kind === "thermal";
  const direct = desktop && thermal && prefs.mode === "direct";
  const a4Direct = desktop && !thermal && prefs.a4Mode === "direct";

  async function testPrint() {
    setTesting(true);
    try {
      await printReceiptHtml(buildReceiptHtml(sampleSale(), shopName), {
        jobName: "تجربة الطباعة",
        openDrawer: true,
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <ChoiceCards
        label="نوع الطابعة"
        items={KINDS}
        value={prefs.kind}
        onChange={(kind) => setPrinterPrefs({ kind })}
      />

      {thermal ? (
        <SettingGroup title="إعدادات الطابعة الحرارية">
          {desktop && (
            <SwitchRow
              id="printer-direct"
              title="طباعة فورية بدون نافذة"
              description="الفاتورة تطلع على الطابعة مباشرة بعد البيع. أوقفها فقط لو الطابعة لا تطبع بها."
              checked={prefs.mode === "direct"}
              onChange={(on) =>
                setPrinterPrefs({ mode: on ? "direct" : "dialog" })
              }
            />
          )}
          {direct && (
            <PrinterPicker
              value={prefs.printer}
              onChange={(printer) => setPrinterPrefs({ printer })}
              hint="تعمل مع Xprinter وEpson وRongta وأغلب الطابعات الحرارية."
              emptyHint="اختر طابعة الإيصالات حتى تطبع فوراً."
            />
          )}
          <SettingRow
            title="عرض الورق"
            description="مكتوب على علبة الورق أو أسفل الطابعة."
          >
            <SegmentedTabs
              label="عرض الورق"
              items={PAPERS}
              value={`${prefs.paperMm}` as "80" | "58"}
              onChange={(v) =>
                setPrinterPrefs({ paperMm: Number(v) as PaperWidth })
              }
            />
          </SettingRow>
          {direct && (
            <>
              <SwitchRow
                id="printer-cut"
                title="قص الورق بعد كل فاتورة"
                description="لو الطابعة فيها قطّاعة."
                checked={prefs.cut}
                onChange={(cut) => setPrinterPrefs({ cut })}
              />
              <SwitchRow
                id="printer-drawer"
                title="فتح درج النقود تلقائياً"
                description="مع البيع النقدي ورد المرتجع نقداً، للدرج الموصّل بالطابعة."
                checked={prefs.openDrawer}
                onChange={(openDrawer) => setPrinterPrefs({ openDrawer })}
              />
            </>
          )}
        </SettingGroup>
      ) : desktop ? (
        <SettingGroup title="إعدادات طابعة A4">
          <SwitchRow
            id="a4-direct"
            title="طباعة فورية بدون نافذة"
            description="الفاتورة تطلع على الطابعة المختارة مباشرة بعد البيع، بدون سؤال كل مرة."
            checked={prefs.a4Mode === "direct"}
            onChange={(on) =>
              setPrinterPrefs({ a4Mode: on ? "direct" : "dialog" })
            }
          />
          {a4Direct && (
            <PrinterPicker
              value={prefs.a4Printer}
              onChange={(a4Printer) => setPrinterPrefs({ a4Printer })}
              hint="أي طابعة عادية (ليزر أو حبر) معرّفة في ويندوز."
              emptyHint="اختر الطابعة التي تطبع عليها الفواتير A4."
            />
          )}
          {!a4Direct && (
            <div className="flex gap-3 py-3 text-xs leading-relaxed text-muted-foreground">
              <IconInfoCircle className="size-5 shrink-0 text-primary" />
              <p>
                بعد كل بيع تظهر نافذة الطباعة لتختار الطابعة. مفيد لو تريد
                أحياناً «Microsoft Print to PDF» لحفظ الفاتورة كملف.
              </p>
            </div>
          )}
        </SettingGroup>
      ) : (
        <p className="text-xs text-muted-foreground">
          من المتصفح تظهر نافذة الطباعة. الطباعة الفورية في برنامج سطح المكتب.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-[11px] text-muted-foreground">
          هذه الإعدادات لهذا الجهاز فقط، لأن كل جهاز موصّل بطابعته.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void testPrint()}
          disabled={
            testing ||
            (direct && !prefs.printer) ||
            (a4Direct && !prefs.a4Printer)
          }
          className="gap-2"
        >
          {testing ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconPrinter className="size-4" />
          )}
          طباعة فاتورة تجربة
        </Button>
      </div>
    </div>
  );
}

/** اختيار طابعة من طابعات ويندوز (الحرارية أو A4). */
function PrinterPicker({
  value,
  onChange,
  hint,
  emptyHint,
}: {
  value: string | null;
  onChange: (printer: string | null) => void;
  hint: string;
  emptyHint: string;
}) {
  const printers = useQuery({
    queryKey: ["local-printers"],
    queryFn: listPrinters,
    staleTime: 60_000,
  });

  const list = printers.data ?? [];
  const missing =
    value !== null && printers.isSuccess && !list.some((p) => p.name === value);
  const items = [
    { value: NO_PRINTER, label: "— اختر الطابعة —" },
    ...list.map((p) => ({
      value: p.name,
      label: p.is_default ? `${p.name} (الافتراضية)` : p.name,
    })),
    ...(missing && value ? [{ value, label: `${value} (غير موصّلة)` }] : []),
  ];

  return (
    <SettingRow
      title="الطابعة"
      description={
        printers.isError
          ? extractErrorMessage(printers.error, "تعذّر قراءة الطابعات")
          : missing
            ? "الطابعة المختارة غير موجودة الآن. تأكد من توصيلها وتشغيلها."
            : !value
              ? emptyHint
              : hint
      }
    >
      <div className="flex items-center gap-2">
        <OptionSelect
          label="الطابعة"
          items={items}
          value={value ?? NO_PRINTER}
          onChange={(next) => onChange(next === NO_PRINTER ? null : next)}
          className="w-64 max-w-[60vw]"
        />
        <AppTooltip message="تحديث قائمة الطابعات">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="تحديث قائمة الطابعات"
            onClick={() => printers.refetch()}
            disabled={printers.isFetching}
            className="size-10"
          >
            {printers.isFetching ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconRefresh className="size-4" />
            )}
          </Button>
        </AppTooltip>
      </div>
    </SettingRow>
  );
}
