/**
 * ملخص اليوم/الأسبوع بشرائح (مثل «ملخص أسبوعك» في التطبيقات الكبيرة): من أرقام الخادم الجاهزة
 * إلى قائمة شرائح للعرض، مع «تحليل سريع» بقواعد بسيطة (لا ذكاء اصطناعي ولا طلب إضافي).
 *
 * بلا React ومُختبر. المال بالقروش، والكميات × 1000 (نفس قاعدة الخادم).
 *
 * التحليل: كل قاعدة تفحص رقماً واحداً مقابل حدّ واضح وتعطي ملاحظة بدرجة أهمية،
 * ونعرض أهم 4 فقط (التحذير المهم قبل الخبر الجيد). لا ملاحظات = «يوم مستقر».
 */
import type {
  BranchRecord,
  SensitiveData,
  ShiftData,
  Summary,
  Totals,
  TopSeller,
} from "@/api/types";
import { change, missingBranches } from "@/features/dashboard/lib/insights";
import { formatArabicCount, formatPiastres } from "@/lib/format";
import {
  addDays,
  formatRange,
  formatShortDay,
  formatWeekday,
  parseIsoDay,
  toIsoDay,
  type DateRange,
} from "@/lib/period";

export type RecapPeriod = "day" | "week";
export type Accent = "blue" | "orange" | "green" | "red" | "amber" | "violet";
export type Tone = "good" | "warn" | "info";
/** أسماء Ionicons (نص عادي هنا حتى يبقى الملف بلا React). */
export type IconName = string;

export interface ChangePill {
  text: string;
  tone: "up" | "down" | "flat";
}

export interface Insight {
  icon: IconName;
  tone: Tone;
  title: string;
  body: string;
  /** للترتيب فقط: الأعلى أولاً. */
  score: number;
}

export type Slide =
  | { kind: "intro"; shop: string; periodLabel: string; period: RecapPeriod }
  | {
      kind: "stat";
      icon: IconName;
      accent: Accent;
      eyebrow: string;
      value: number;
      format: "money" | "count";
      caption: string | null;
      change: ChangePill | null;
      extra: { label: string; value: string }[];
    }
  | {
      kind: "branches";
      rows: { name: string; net: number; share: number }[];
      caption: string;
    }
  | {
      kind: "days";
      bars: { label: string; value: number; best: boolean }[];
      caption: string;
    }
  | {
      kind: "top";
      items: { name: string; revenue: number; qty: string }[];
      caption: string;
    }
  | {
      kind: "payments";
      parts: {
        key: "cash" | "credit" | "wallet";
        label: string;
        value: number;
        share: number;
      }[];
    }
  | { kind: "insights"; items: Insight[] }
  | { kind: "empty"; periodLabel: string; missing: number }
  | { kind: "outro"; period: RecapPeriod; title: string; body: string };

export interface RecapInput {
  period: RecapPeriod;
  /** آخر يوم في الفترة (YYYY-MM-DD). */
  date: string;
  shopName: string;
  summary: Summary;
  top?: TopSeller[];
  sensitive?: BranchRecord<SensitiveData>[];
  shifts?: BranchRecord<ShiftData>[];
  now?: Date;
}

/** الفترة: يوم واحد، أو آخر 7 أيام تنتهي بالتاريخ. */
export function recapRange(period: RecapPeriod, date: string): DateRange {
  if (period === "day") return { from: date, to: date };
  return { from: toIsoDay(addDays(parseIsoDay(date), -6)), to: date };
}

export function periodLabel(
  period: RecapPeriod,
  date: string,
  now = new Date(),
): string {
  if (period === "week")
    return `أسبوعك · ${formatRange(recapRange("week", date), now)}`;
  const rel = formatRange({ from: date, to: date }, now);
  const full = `${formatWeekday(date)} ${formatShortDay(date)}`;
  return rel === formatShortDay(date) ? full : `${rel} · ${full}`;
}

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

const money = (piastres: number) => `${formatPiastres(piastres)} ج.م`;

function pill(current: number, previous: number): ChangePill | null {
  const c = change(current, previous);
  if (c.direction === "flat") return { text: "بدون تغيير", tone: "flat" };
  if (c.pct === null) return null;
  const v = Math.round(Math.abs(c.pct));
  if (v === 0) return { text: "بدون تغيير يُذكر", tone: "flat" };
  return { text: `${c.pct > 0 ? "▲" : "▼"} ${v}%`, tone: c.direction };
}

const qtyText = (qty: number, unit: string) => {
  const n = qty / 1000;
  return `${Number.isInteger(n) ? n : n.toFixed(1)} ${unit}`;
};

/* ================= التحليل السريع ================= */

export function analyze(input: RecapInput): Insight[] {
  const { summary, period } = input;
  const t = summary.totals;
  const prev = summary.compare.previous;
  const p = prev.totals;
  const prevLabel = period === "day" ? "اليوم السابق" : "الأسبوع السابق";
  const out: Insight[] = [];
  const add = (i: Insight) => out.push(i);

  // 1) اتجاه المبيعات مقابل الفترة السابقة (فقط لو للفترة السابقة بيانات فعلاً).
  if (prev.branches_reported > 0 && p.net > 0) {
    const c = change(t.net, p.net);
    const v = Math.round(Math.abs(c.pct ?? 0));
    if (c.pct !== null && c.pct >= 10)
      add({
        icon: "trending-up-outline",
        tone: "good",
        title: `المبيعات أعلى بـ ${v}% من ${prevLabel}`,
        body: "استمر على ما نجح: راجع الأصناف والفروع التي قادت الزيادة.",
        score: 50 + Math.min(v, 40),
      });
    else if (c.pct !== null && c.pct <= -10)
      add({
        icon: "trending-down-outline",
        tone: "warn",
        title: `المبيعات أقل بـ ${v}% من ${prevLabel}`,
        body: "راجع الفرع أو الصنف الأقل حركة، وتأكد أن الأصناف المطلوبة غير ناقصة.",
        score: 60 + Math.min(v, 40),
      });
  }

  // 2) لليوم: مقارنة بنفس اليوم الأسبوع الماضي (أدق من «أمس» لأن أيام الأسبوع تختلف).
  const wk = summary.compare.week_ago;
  if (period === "day" && wk && wk.branches_reported > 0 && wk.totals.net > 0) {
    const c = change(t.net, wk.totals.net);
    const v = Math.round(Math.abs(c.pct ?? 0));
    if (c.pct !== null && Math.abs(c.pct) >= 15)
      add({
        icon: c.pct > 0 ? "calendar-outline" : "calendar-clear-outline",
        tone: c.pct > 0 ? "good" : "warn",
        title: `${c.pct > 0 ? "أعلى" : "أقل"} بـ ${v}% من ${formatWeekday(input.date)} الماضي`,
        body: "المقارنة بنفس اليوم من الأسبوع تستبعد اختلاف أيام الزحام.",
        score: 45 + Math.min(v, 30),
      });
  }

  // 3) المرتجع والخصم كنسبة من الإيراد.
  if (t.revenue > 0) {
    const r = t.returns / t.revenue;
    if (r >= 0.05)
      add({
        icon: "return-down-back-outline",
        tone: "warn",
        title: `المرتجع ${pct(t.returns, t.revenue)}% من المبيعات`,
        body: "نسبة مرتفعة: راجع الأصناف المرتجعة وسبب الإرجاع، والمرتجعات الكبيرة في العمليات الحساسة.",
        score: 55 + Math.round(r * 200),
      });
    const d = t.discounts / t.revenue;
    if (d >= 0.07)
      add({
        icon: "pricetags-outline",
        tone: "warn",
        title: `الخصومات ${pct(t.discounts, t.revenue)}% من المبيعات`,
        body: "الخصم الكبير يأكل الربح بسرعة: راجع حدود خصم الكاشير والعروض السارية.",
        score: 50 + Math.round(d * 200),
      });
  }

  // 4) هامش الربح مقابل الفترة السابقة (فرق 3 نقاط أو أكثر).
  if (t.net > 0 && p.net > 0 && prev.branches_reported > 0) {
    const m = (t.profit / t.net) * 100;
    const pm = (p.profit / p.net) * 100;
    const diff = Math.round(m - pm);
    if (diff <= -3)
      add({
        icon: "analytics-outline",
        tone: "warn",
        title: `هامش الربح انخفض من ${Math.round(pm)}% إلى ${Math.round(m)}%`,
        body: "غالباً بسبب خصومات أو ارتفاع سعر الشراء: راجع أسعار البيع للأصناف التي زادت تكلفتها.",
        score: 58 + Math.min(-diff * 2, 30),
      });
    else if (diff >= 3)
      add({
        icon: "analytics-outline",
        tone: "good",
        title: `هامش الربح تحسّن إلى ${Math.round(m)}%`,
        body: `كان ${Math.round(pm)}% في ${prevLabel}.`,
        score: 40 + Math.min(diff * 2, 20),
      });
  }

  // 5) المصروفات مقابل الربح.
  if (t.expenses > 0 && t.profit > 0) {
    if (t.net_profit < 0)
      add({
        icon: "wallet-outline",
        tone: "warn",
        title: "المصروفات أكبر من الربح",
        body: `صافي الربح بعد المصروفات ${money(t.net_profit)}: راجع بنود المصروفات الكبيرة.`,
        score: 80,
      });
    else if (t.expenses >= t.profit * 0.5)
      add({
        icon: "wallet-outline",
        tone: "info",
        title: `المصروفات ${pct(t.expenses, t.profit)}% من الربح`,
        body: "جزء كبير من الربح يذهب للمصروفات.",
        score: 42,
      });
  }

  // 6) البيع الآجل.
  const paid = t.cash + t.credit + t.wallet;
  if (paid > 0 && t.credit / paid >= 0.3)
    add({
      icon: "time-outline",
      tone: "info",
      title: `${pct(t.credit, paid)}% من البيع آجل`,
      body: "تابع التحصيل من العملاء حتى لا تتجمّد السيولة.",
      score: 48,
    });

  // 7) الاعتماد على صنف واحد.
  const first = input.top?.[0];
  if (first && t.revenue > 0 && first.revenue / t.revenue >= 0.25)
    add({
      icon: "cube-outline",
      tone: "info",
      title: `«${first.name}» = ${pct(first.revenue, t.revenue)}% من الإيراد`,
      body: "صنف واحد يحمل جزءاً كبيراً من البيع: تأكد أن مخزونه يكفي في كل الفروع.",
      score: 44,
    });

  // 8) متوسط الفاتورة.
  if (t.count > 0 && p.count > 0 && prev.branches_reported > 0) {
    const c = change(t.net / t.count, p.net / p.count);
    const v = Math.round(Math.abs(c.pct ?? 0));
    if (c.pct !== null && c.pct >= 10)
      add({
        icon: "basket-outline",
        tone: "good",
        title: `متوسط الفاتورة ارتفع ${v}%`,
        body: `أصبح ${money(Math.round(t.net / t.count))}: العملاء يشترون أكثر في الزيارة الواحدة.`,
        score: 38 + Math.min(v, 20),
      });
    else if (c.pct !== null && c.pct <= -10)
      add({
        icon: "basket-outline",
        tone: "info",
        title: `متوسط الفاتورة انخفض ${v}%`,
        body: "جرّب عرض الأصناف المكمّلة بجانب الكاشير لرفع قيمة الفاتورة.",
        score: 40 + Math.min(v, 20),
      });
  }

  // 9) فرق كبير بين الفروع.
  const selling = summary.branches.filter((b) => b.is_active && b.net > 0);
  if (selling.length >= 2) {
    const best = selling[0]!;
    const worst = selling[selling.length - 1]!;
    if (best.net >= worst.net * 3)
      add({
        icon: "git-compare-outline",
        tone: "info",
        title: `فرع ${best.name} يبيع أكثر من 3 أضعاف فرع ${worst.name}`,
        body: "قارن الأصناف المتوفرة والعروض بين الفرعين.",
        score: 36,
      });
  }

  // 10) العمليات الحساسة وعجز الورديات.
  const sens = input.sensitive?.length ?? 0;
  if (sens > 0)
    add({
      icon: "shield-outline",
      tone: "warn",
      title: formatArabicCount(sens, {
        one: "عملية حساسة واحدة",
        two: "عمليتان حساستان",
        few: "عمليات حساسة",
        many: "عملية حساسة",
      }),
      body: "خصم أو مرتجع فوق الحد الذي حددته: راجعها من «العمليات الحساسة».",
      score: 62 + Math.min(sens * 2, 15),
    });
  const short = (input.shifts ?? []).filter((s) => s.data.difference < 0);
  if (short.length > 0) {
    const total = short.reduce((a, s) => a + s.data.difference, 0);
    add({
      icon: "cash-outline",
      tone: "warn",
      title: `عجز نقدية ${money(-total)}`,
      body: `في ${formatArabicCount(short.length, { one: "وردية واحدة", two: "ورديتين", few: "ورديات", many: "وردية" })}: راجع «الورديات».`,
      score: 70,
    });
  }

  // 11) بيانات ناقصة: الأرقام قد تكون أقل من الحقيقة.
  const missing = missingBranches(summary).length;
  if (missing > 0)
    add({
      icon: "cloud-offline-outline",
      tone: "info",
      title: `${formatArabicCount(missing, { one: "فرع لم يرسل", two: "فرعان لم يرسلا", few: "فروع لم ترسل", many: "فرعاً لم يرسل" })} بياناته كاملة`,
      body: "الأرقام قد تزيد بعد اتصاله ومزامنته.",
      score: 65,
    });

  out.sort((a, b) => b.score - a.score);
  if (out.length === 0)
    return [
      {
        icon: "checkmark-circle-outline",
        tone: "good",
        title: period === "day" ? "يوم مستقر" : "أسبوع مستقر",
        body: "لا ملاحظات تستحق الانتباه: الأرقام قريبة من المعتاد.",
        score: 0,
      },
    ];
  return out.slice(0, 4);
}

/* ================= الشرائح ================= */

function paymentsSlide(t: Totals): Slide | null {
  const total = t.cash + t.credit + t.wallet;
  if (total <= 0) return null;
  const parts = (
    [
      { key: "cash", label: "نقدي", value: t.cash },
      { key: "wallet", label: "محفظة / بطاقة", value: t.wallet },
      { key: "credit", label: "آجل", value: t.credit },
    ] as const
  )
    .filter((x) => x.value > 0)
    .map((x) => ({ ...x, share: x.value / total }));
  return { kind: "payments", parts };
}

export function buildRecap(input: RecapInput): Slide[] {
  const { summary, period } = input;
  const now = input.now ?? new Date();
  const t = summary.totals;
  const p = summary.compare.previous;
  const label = periodLabel(period, input.date, now);
  const prevLabel = period === "day" ? "عن اليوم السابق" : "عن الأسبوع السابق";
  const slides: Slide[] = [
    { kind: "intro", shop: input.shopName, periodLabel: label, period },
  ];

  if (t.count === 0) {
    slides.push({
      kind: "empty",
      periodLabel: label,
      missing: missingBranches(summary).length,
    });
    slides.push(outro(period));
    return slides;
  }

  const hasPrev = p.branches_reported > 0;
  const wk = summary.compare.week_ago;
  const netExtra: { label: string; value: string }[] = [];
  if (period === "day" && wk && wk.branches_reported > 0) {
    const c = pill(t.net, wk.totals.net);
    if (c)
      netExtra.push({
        label: `مقارنة بـ${formatWeekday(input.date)} الماضي`,
        value: c.text,
      });
  }
  if (t.returns > 0)
    netExtra.push({ label: "بعد خصم المرتجع", value: money(t.returns) });
  slides.push({
    kind: "stat",
    icon: "cash-outline",
    accent: "green",
    eyebrow: "صافي المبيعات",
    value: t.net,
    format: "money",
    caption: hasPrev ? prevLabel : null,
    change: hasPrev ? pill(t.net, p.totals.net) : null,
    extra: netExtra,
  });

  slides.push({
    kind: "stat",
    icon: "receipt-outline",
    accent: "blue",
    eyebrow: "عدد الفواتير",
    value: t.count,
    format: "count",
    caption: `متوسط الفاتورة ${money(Math.round(t.net / t.count))}`,
    change: hasPrev ? pill(t.count, p.totals.count) : null,
    extra: [],
  });

  const profitExtra = [
    { label: "هامش الربح", value: `${pct(t.profit, t.net)}%` },
  ];
  if (t.expenses > 0) {
    profitExtra.push({ label: "المصروفات", value: money(t.expenses) });
    profitExtra.push({
      label: "الصافي بعد المصروفات",
      value: money(t.net_profit),
    });
  }
  slides.push({
    kind: "stat",
    icon: "diamond-outline",
    accent: "violet",
    eyebrow: "الربح",
    value: t.profit,
    format: "money",
    caption: hasPrev ? prevLabel : null,
    change: hasPrev ? pill(t.profit, p.totals.profit) : null,
    extra: profitExtra,
  });

  const branches = summary.branches.filter((b) => b.is_active && b.net > 0);
  if (branches.length >= 2) {
    const sum = branches.reduce((a, b) => a + b.net, 0);
    slides.push({
      kind: "branches",
      rows: branches
        .slice(0, 5)
        .map((b) => ({ name: b.name, net: b.net, share: b.net / sum })),
      caption: `فرع ${branches[0]!.name} في الصدارة بـ ${pct(branches[0]!.net, sum)}% من المبيعات`,
    });
  }

  if (period === "week" && summary.days.length >= 2) {
    const max = Math.max(...summary.days.map((d) => d.net));
    const best = summary.days.find((d) => d.net === max);
    slides.push({
      kind: "days",
      bars: summary.days.map((d) => ({
        label: formatWeekday(d.day),
        value: d.net,
        best: d === best && max > 0,
      })),
      caption:
        best && max > 0
          ? `أقوى أيامك: ${formatWeekday(best.day)} ${formatShortDay(best.day)}`
          : "",
    });
  }

  const top = (input.top ?? []).slice(0, 3);
  if (top.length > 0)
    slides.push({
      kind: "top",
      items: top.map((x) => ({
        name: x.name,
        revenue: x.revenue,
        qty: qtyText(x.qty, x.unit),
      })),
      caption:
        period === "day" ? "الأكثر مبيعاً اليوم" : "الأكثر مبيعاً هذا الأسبوع",
    });

  const pay = paymentsSlide(t);
  if (pay) slides.push(pay);

  slides.push({ kind: "insights", items: analyze(input) });
  slides.push(outro(period));
  return slides;
}

function outro(period: RecapPeriod): Slide {
  return period === "day"
    ? {
        kind: "outro",
        period,
        title: "هذا كان يومك",
        body: "نراك غداً بملخص جديد. بالتوفيق في مبيعاتك",
      }
    : {
        kind: "outro",
        period,
        title: "هذا كان أسبوعك",
        body: "نراك الأسبوع القادم بملخص جديد. بالتوفيق",
      };
}
