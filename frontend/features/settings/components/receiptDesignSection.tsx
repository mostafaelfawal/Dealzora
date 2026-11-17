"use client";

import {
  IconArrowBackUp,
  IconCheck,
  IconDeviceFloppy,
  IconLoader2,
  IconPhotoPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildReceiptHtml } from "@/features/sales/lib/receipt";
import { BRANDING_LINE } from "@/features/sales/lib/receiptDocument";
import { usePlan } from "@/lib/plan";
import { usePrinterPrefs, type PrinterKind } from "@/lib/printerPrefs";
import {
  ACCENT_COLORS,
  logoFromFile,
  RECEIPT_LIMITS,
  useReceiptConfig,
  type ReceiptConfig,
  type ReceiptFontSize,
} from "@/lib/receiptConfig";
import { cn } from "@/lib/utils";

import { useSaveReceiptConfig, useShopName } from "../hooks/useSettings";
import { sampleSale } from "../lib/sampleReceipt";
import { SettingGroup, SettingRow, SwitchRow } from "./settingsControls";

const PREVIEW_KINDS = [
  { id: "thermal" as const, label: "إيصال حراري" },
  { id: "a4" as const, label: "فاتورة A4" },
];

const FONT_SIZES = [
  { id: "small" as const, label: "صغير" },
  { id: "normal" as const, label: "عادي" },
  { id: "large" as const, label: "كبير" },
];

/** شكل الفاتورة للمحل كله: يمين التعديلات، ويسار معاينة حيّة بالفاتورة الحقيقية. */
export function ReceiptDesignSection() {
  const saved = useReceiptConfig();
  const save = useSaveReceiptConfig();
  const shopName = useShopName().data ?? "اسم المحل";
  const prefs = usePrinterPrefs();
  const freePlan = Boolean(usePlan().data?.isFree);
  const [draft, setDraft] = useState<ReceiptConfig | null>(null);
  const [preview, setPreview] = useState<PrinterKind>(prefs.kind);

  const cfg = draft ?? saved;
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<ReceiptConfig>) => setDraft({ ...cfg, ...patch });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="min-w-0 space-y-6">
        <SettingGroup title="الشعار">
          <LogoPicker
            logo={cfg.logo}
            show={cfg.showLogo}
            onLogo={(logo) => set({ logo, showLogo: true })}
            onShow={(showLogo) => set({ showLogo })}
          />
        </SettingGroup>

        <SettingGroup title="بيانات المحل على الفاتورة">
          <div className="grid gap-3 py-3 sm:grid-cols-2">
            <TextField
              id="rc-address"
              label="العنوان"
              placeholder="مثال: 12 شارع الجمهورية، المنصورة"
              value={cfg.address}
              max={RECEIPT_LIMITS.address}
              onChange={(address) => set({ address })}
              className="sm:col-span-2"
            />
            <TextField
              id="rc-phone"
              label="رقم التليفون"
              placeholder="مثال: 01012345678"
              value={cfg.phone}
              max={RECEIPT_LIMITS.phone}
              onChange={(phone) => set({ phone })}
              ltr
            />
            <TextField
              id="rc-tax"
              label="الرقم الضريبي (اختياري)"
              placeholder="مثال: 123-456-789"
              value={cfg.taxNumber}
              max={RECEIPT_LIMITS.taxNumber}
              onChange={(taxNumber) => set({ taxNumber })}
              ltr
            />
            <TextField
              id="rc-note"
              label="سطر تحت اسم المحل (اختياري)"
              placeholder="مثال: توصيل مجاني للمنازل"
              value={cfg.headerNote}
              max={RECEIPT_LIMITS.headerNote}
              onChange={(headerNote) => set({ headerNote })}
              className="sm:col-span-2"
            />
          </div>
        </SettingGroup>

        <SettingGroup title="ماذا يظهر في الفاتورة">
          <SwitchRow
            id="rc-cashier"
            title="اسم الكاشير"
            checked={cfg.showCashier}
            onChange={(showCashier) => set({ showCashier })}
          />
          <SwitchRow
            id="rc-customer"
            title="اسم العميل"
            description="للفواتير المسجّلة على عميل."
            checked={cfg.showCustomer}
            onChange={(showCustomer) => set({ showCustomer })}
          />
          <SwitchRow
            id="rc-payment"
            title="تفاصيل الدفع"
            description="طريقة الدفع والمدفوع والباقي والآجل."
            checked={cfg.showPaymentDetails}
            onChange={(showPaymentDetails) => set({ showPaymentDetails })}
          />
          <SwitchRow
            id="rc-barcode"
            title="باركود رقم الفاتورة"
            description="امسحه بقارئ الباركود في بحث الفواتير أو المرتجع فتظهر الفاتورة فوراً."
            checked={cfg.showBarcode}
            onChange={(showBarcode) => set({ showBarcode })}
          />
          <SwitchRow
            id="rc-branding"
            title={`سطر «${BRANDING_LINE}»`}
            description={
              freePlan
                ? "يظهر دائماً في خطة «بَسطة» المجانية، ويمكن إخفاؤه عند الاشتراك في أي خطة مدفوعة."
                : "سطر صغير في آخر الفاتورة. يمكنك إظهاره أو إخفاؤه."
            }
            // المجانية: السطر إجباري فالمفتاح مفعّل ومقفول مهما كانت القيمة المحفوظة.
            checked={freePlan || cfg.showBranding}
            disabled={freePlan}
            onChange={(showBranding) => set({ showBranding })}
          />
        </SettingGroup>

        <SettingGroup title="آخر الفاتورة">
          <div className="space-y-3 py-3">
            <TextArea
              id="rc-footer"
              label="رسالة الشكر"
              placeholder="شكراً لزيارتكم"
              value={cfg.footer}
              max={RECEIPT_LIMITS.footer}
              onChange={(footer) => set({ footer })}
            />
            <TextArea
              id="rc-terms"
              label="شروط الاستبدال والاسترجاع (فاتورة A4 فقط)"
              placeholder="مثال: الاستبدال خلال 14 يوماً بالفاتورة، والبضاعة بحالتها الأصلية."
              value={cfg.terms}
              max={RECEIPT_LIMITS.terms}
              onChange={(terms) => set({ terms })}
            />
          </div>
        </SettingGroup>

        <SettingGroup title="المظهر">
          <SwitchRow
            id="rc-compact"
            title="إيصال حراري مختصر (يوفّر الورق)"
            description="بيانات الفاتورة في سطور أقل، والصنف بكمية 1 في سطر واحد، والدفع في عمودين."
            checked={cfg.compact}
            onChange={(compact) => set({ compact })}
          />
          <SettingRow
            title="حجم الخط (الإيصال الحراري)"
            description="«كبير» أوضح لكبار السن، و«صغير» يوفّر ورق."
          >
            <SegmentedTabs
              label="حجم الخط"
              items={FONT_SIZES}
              value={cfg.fontSize}
              onChange={(fontSize: ReceiptFontSize) => set({ fontSize })}
            />
          </SettingRow>
          <SettingRow
            title="لون الفاتورة (A4)"
            description="للعناوين والجدول والإجمالي."
          >
            <div
              role="radiogroup"
              aria-label="لون الفاتورة"
              className="flex gap-2"
            >
              {ACCENT_COLORS.map((c) => {
                const active = cfg.accent === c.value;
                return (
                  <AppTooltip key={c.value} message={c.label}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={c.label}
                      onClick={() => set({ accent: c.value })}
                      style={{ backgroundColor: c.value }}
                      className={cn(
                        "flex size-8 items-center justify-center text-white outline-none transition-transform",
                        "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
                        active
                          ? "scale-110 ring-2 ring-offset-2 ring-foreground/30"
                          : "hover:scale-105",
                      )}
                    >
                      {active && <IconCheck className="size-4" />}
                    </button>
                  </AppTooltip>
                );
              })}
            </div>
          </SettingRow>
        </SettingGroup>
      </div>

      <aside className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">معاينة</p>
          <SegmentedTabs
            label="نوع المعاينة"
            items={PREVIEW_KINDS}
            value={preview}
            onChange={setPreview}
          />
        </div>
        <ReceiptPreview
          html={buildReceiptHtml(sampleSale(), shopName, false, {
            kind: preview,
            config: cfg,
            paperMm: prefs.paperMm,
          })}
          kind={preview}
          paperMm={prefs.paperMm}
        />
        <p className="text-[11px] text-muted-foreground">
          فاتورة تجريبية. التعديل يظهر هنا فوراً، ويُطبّق على الفواتير بعد الحفظ.
        </p>
      </aside>

      {/* شريط الحفظ يظهر فقط عند وجود تعديل */}
      {dirty && (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5 xl:col-span-2">
          <p className="text-xs font-medium">عندك تعديلات لم تُحفظ بعد.</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraft(null)}
              disabled={save.isPending}
              className="gap-1.5"
            >
              <IconArrowBackUp className="size-4" />
              تراجع
            </Button>
            <Button
              type="button"
              onClick={() =>
                save.mutate(cfg, { onSuccess: () => setDraft(null) })
              }
              disabled={save.isPending}
              className="gap-1.5"
            >
              {save.isPending ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconDeviceFloppy className="size-4" />
              )}
              حفظ شكل الفاتورة
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LogoPicker({
  logo,
  show,
  onLogo,
  onShow,
}: {
  logo: string | null;
  show: boolean;
  onLogo: (logo: string | null) => void;
  onShow: (show: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      onLogo(await logoFromFile(file));
    } catch (err) {
      toast.error((err as Error).message || "تعذّر قراءة الصورة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 py-3">
        <div className="flex size-20 shrink-0 items-center justify-center border bg-white p-1">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- صورة مضمّنة data: لا تحتاج تحسين
            <img
              src={logo}
              alt="شعار المحل"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <IconPhotoPlus className="size-7 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            صورة PNG أو JPG. يُفضّل خلفية بيضاء، وتُطبع أبيض وأسود على الحرارية.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="gap-1.5"
            >
              {busy ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconPhotoPlus className="size-4" />
              )}
              {logo ? "تغيير الشعار" : "رفع الشعار"}
            </Button>
            {logo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onLogo(null)}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <IconTrash className="size-4" />
                حذف
              </Button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => void pick(e)}
          />
        </div>
      </div>
      {logo && (
        <SwitchRow
          id="rc-logo"
          title="إظهار الشعار في الفاتورة"
          checked={show}
          onChange={onShow}
        />
      )}
    </>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  max,
  placeholder,
  ltr,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  ltr?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        dir={ltr ? "ltr" : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-10", ltr && "text-right")}
      />
    </div>
  );
}

function TextArea({
  id,
  label,
  value,
  onChange,
  max,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {value.length}/{max}
        </span>
      </div>
      <Textarea
        id={id}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm"
      />
    </div>
  );
}

/** A4 بالبكسل (96dpi). */
const A4_PX = { w: 794, h: 1123 };
const MM = 96 / 25.4;

const pageWidthPx = (kind: PrinterKind, paperMm: number) =>
  kind === "a4" ? A4_PX.w : Math.round(paperMm * MM);

/**
 * المعاينة = نفس HTML الطباعة داخل iframe، مصغّرة لتناسب العمود.
 * الضغط عليها (مؤشر العدسة +) يكبّرها في نافذة ليراها التاجر بوضوح.
 */
function ReceiptPreview({
  html,
  kind,
  paperMm,
}: {
  html: string;
  kind: PrinterKind;
  paperMm: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(320);
  const [zoomed, setZoomed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1024);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const pageWidth = pageWidthPx(kind, paperMm);
  const scale = Math.min(1, boxWidth / pageWidth);
  // التكبير: الحراري حتى ضعف حجمه الحقيقي، والـ A4 بحجمه الحقيقي، بحدود عرض الشاشة.
  const zoomScale = Math.min(
    kind === "a4" ? 1 : 2,
    (viewportWidth - 64) / pageWidth,
  );

  return (
    <>
      <div
        ref={box}
        className="max-h-[70vh] overflow-y-auto border bg-muted/40 p-3"
      >
        <AppTooltip message="اضغط للتكبير">
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="تكبير المعاينة"
            className="group relative mx-auto block cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <PreviewPage
              html={html}
              kind={kind}
              paperMm={paperMm}
              scale={scale}
            />
            {/* الـ iframe يبتلع الماوس: طبقة شفافة فوقه تُظهر مؤشر العدسة وتستقبل الضغط */}
            <span
              aria-hidden
              className="absolute inset-0 transition-colors group-hover:bg-foreground/3"
            />
          </button>
        </AppTooltip>
      </div>

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent
          // عرض صريح: w-auto مع left-1/2 في RTL يضيّق النافذة فتفيض الفاتورة يساراً وتنقص.
          style={{ width: pageWidth * zoomScale + 64 }}
          className="max-h-[92vh] max-w-[calc(100%-2rem)] overflow-y-auto bg-muted p-6 sm:max-w-[calc(100%-2rem)]"
        >
          <DialogTitle className="sr-only">معاينة الفاتورة مكبّرة</DialogTitle>
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="تصغير المعاينة"
            className="mx-auto block cursor-zoom-out outline-none"
          >
            <span className="relative block">
              <PreviewPage
                html={html}
                kind={kind}
                paperMm={paperMm}
                scale={zoomScale}
              />
              <span aria-hidden className="absolute inset-0" />
            </span>
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** صفحة الفاتورة بمقياس معيّن: الارتفاع يُقاس من محتوى الـ iframe بعد التحميل. */
function PreviewPage({
  html,
  kind,
  paperMm,
  scale,
}: {
  html: string;
  kind: PrinterKind;
  paperMm: number;
  scale: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [contentHeight, setContentHeight] = useState(600);

  const pageWidth = pageWidthPx(kind, paperMm);
  const pageHeight =
    kind === "a4" ? Math.max(A4_PX.h, contentHeight) : contentHeight;

  function measure() {
    const doc = frame.current?.contentDocument;
    if (doc) setContentHeight(Math.ceil(doc.documentElement.scrollHeight) + 8);
  }

  return (
    <span
      className="block overflow-hidden bg-white shadow-md"
      style={{ width: pageWidth * scale, height: pageHeight * scale }}
    >
      <iframe
        ref={frame}
        title="معاينة الفاتورة"
        // هوامش @page لا تظهر على الشاشة: نضيفها للمعاينة فقط.
        srcDoc={
          kind === "a4"
            ? html.replace(
                "</head>",
                "<style>@media screen{body{padding:12mm}}</style></head>",
              )
            : html
        }
        onLoad={measure}
        sandbox="allow-same-origin"
        style={{
          width: pageWidth,
          height: pageHeight,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top right",
          background: "#fff",
          pointerEvents: "none",
        }}
      />
    </span>
  );
}
