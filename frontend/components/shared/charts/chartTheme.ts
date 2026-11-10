/**
 * ألوان الرسوم = متغيرات CSS من app/globals.css فقط (تتبدّل تلقائياً مع الوضع الداكن).
 *
 * درجات --chart-1..5 رمادية (بلا تشبّع)، لذلك:
 * - المقدار عبر الزمن: سلسلة واحدة بـ main.
 * - الحالي مقابل السابق: main + muted (متقطع) مع وسيلة إيضاح، لا لون وحده.
 * - الحالة (ربح/خسارة، داخل/خارج): success/destructive المحجوزة، دائماً مع نص.
 * - خريطة الذروة: تدرّج seq-1..5 (فاتح ← غامق).
 */
export const CHART = {
  main: "var(--chart-main)",
  muted: "var(--chart-muted)",
  grid: "var(--chart-grid)",
  axis: "var(--muted-foreground)",
  surface: "var(--card)",
  good: "var(--success)",
  bad: "var(--destructive)",
  warn: "var(--warning)",
  seq: [
    "var(--chart-seq-1)",
    "var(--chart-seq-2)",
    "var(--chart-seq-3)",
    "var(--chart-seq-4)",
    "var(--chart-seq-5)",
  ],
} as const;

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** محاور الرسوم: 12.5K بدل 12,500 حتى لا تزدحم. */
export const formatCompact = (n: number) => compact.format(n);
export const formatFull = (n: number) => full.format(n);

/** خصائص المحاور الموحّدة (خط صغير خافت، بلا خطوط محاور ثقيلة). */
export const AXIS_TICK = { fill: CHART.axis, fontSize: 11 } as const;

/** إعدادات مشتركة: الأعمدة رفيعة بأطراف مدوّرة 4px، والحركة سريعة. */
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_RADIUS_H: [number, number, number, number] = [4, 0, 0, 4]; // أفقي في RTL: الطرف على اليسار
export const ANIMATION = { isAnimationActive: true, animationDuration: 450, animationEasing: "ease-out" } as const;
