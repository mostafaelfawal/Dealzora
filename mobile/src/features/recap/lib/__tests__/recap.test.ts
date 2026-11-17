import type { BranchTotals, Summary, Totals } from "@/api/types";

import { analyze, buildRecap, recapRange } from "../recap";

const ZERO: Totals = {
  count: 0,
  revenue: 0,
  returns: 0,
  net: 0,
  cost: 0,
  profit: 0,
  discounts: 0,
  cash: 0,
  credit: 0,
  wallet: 0,
  expenses: 0,
  eta_waiting: 0,
  eta_accepted: 0,
  eta_rejected: 0,
  net_profit: 0,
};

const totals = (t: Partial<Totals>): Totals => ({ ...ZERO, ...t });

function branch(id: string, name: string, t: Partial<Totals>): BranchTotals {
  return {
    ...totals(t),
    id,
    name,
    code: id,
    is_active: true,
    last_update: "2026-11-17T20:00:00Z",
    reported_days: 1,
    expected_days: 1,
  };
}

function summary(
  t: Partial<Totals>,
  prev: Partial<Totals> | null,
  branches?: BranchTotals[],
): Summary {
  return {
    date_from: "2026-11-17",
    date_to: "2026-11-17",
    totals: totals(t),
    branches: branches ?? [branch("a", "المعادي", t)],
    days: [],
    compare: {
      previous: {
        date_from: "2026-11-16",
        date_to: "2026-11-16",
        totals: totals(prev ?? {}),
        branches_reported: prev ? 1 : 0,
      },
      week_ago: null,
    },
    branches_total: 1,
    generated_at: "2026-11-17T20:00:00Z",
  };
}

const base = {
  count: 100,
  revenue: 1_000_000,
  net: 1_000_000,
  profit: 250_000,
  net_profit: 250_000,
  cash: 1_000_000,
};
const now = new Date(2026, 10, 17, 22);

test("فترة الأسبوع = آخر 7 أيام تنتهي بالتاريخ", () => {
  expect(recapRange("week", "2026-11-20")).toEqual({
    from: "2026-11-14",
    to: "2026-11-20",
  });
  expect(recapRange("day", "2026-11-20")).toEqual({
    from: "2026-11-20",
    to: "2026-11-20",
  });
});

test("يوم بلا فواتير: مقدمة ثم «لا مبيعات» ثم الختام", () => {
  const slides = buildRecap({
    period: "day",
    date: "2026-11-17",
    shopName: "سوبر ماركت النور",
    summary: summary({}, null),
    now,
  });
  expect(slides.map((s) => s.kind)).toEqual(["intro", "empty", "outro"]);
  expect(slides[0]).toMatchObject({ shop: "سوبر ماركت النور" });
});

test("الشرائح الأساسية بالترتيب، والتحليل قبل الختام", () => {
  const slides = buildRecap({
    period: "day",
    date: "2026-11-17",
    shopName: "محل",
    summary: summary(base, base),
    top: [
      {
        key: "k",
        name: "لبن",
        unit: "علبة",
        qty: 12_000,
        revenue: 50_000,
        branches: 1,
      },
    ],
    now,
  });
  expect(slides.map((s) => s.kind)).toEqual([
    "intro",
    "stat",
    "stat",
    "stat",
    "top",
    "payments",
    "insights",
    "outro",
  ]);
  const net = slides[1];
  expect(net).toMatchObject({ value: 1_000_000, change: { tone: "flat" } });
});

test("الفروع: شريحة الترتيب مع فرعين فأكثر", () => {
  const slides = buildRecap({
    period: "day",
    date: "2026-11-17",
    shopName: "محل",
    summary: summary(base, base, [
      branch("a", "المعادي", { net: 700_000 }),
      branch("b", "الدقي", { net: 300_000 }),
    ]),
    now,
  });
  const b = slides.find((s) => s.kind === "branches");
  expect(b).toMatchObject({
    caption: "فرع المعادي في الصدارة بـ 70% من المبيعات",
  });
});

test("التحليل: هبوط المبيعات والمرتجع المرتفع والعجز تظهر، والأهم أولاً", () => {
  const items = analyze({
    period: "day",
    date: "2026-11-17",
    shopName: "محل",
    summary: summary(
      { ...base, net: 600_000, returns: 80_000, profit: 150_000 },
      base,
    ),
    shifts: [
      {
        id: "s",
        branch_id: "a",
        branch_name: "المعادي",
        day: "2026-11-17",
        at: null,
        received_at: "",
        data: {
          cashier: "منى",
          opened_at: "",
          closed_at: "",
          expected: 0,
          counted: 0,
          difference: -5_000,
        },
      },
    ],
  });
  const titles = items.map((i) => i.title);
  expect(titles).toContain("المبيعات أقل بـ 40% من اليوم السابق");
  expect(titles).toContain("المرتجع 8% من المبيعات");
  expect(titles.some((t) => t.startsWith("عجز نقدية"))).toBe(true);
  expect(items.length).toBeLessThanOrEqual(4);
  expect(items[0]!.title).toBe("المبيعات أقل بـ 40% من اليوم السابق");
  for (let i = 1; i < items.length; i++)
    expect(items[i - 1]!.score).toBeGreaterThanOrEqual(items[i]!.score);
});

test("التحليل: لا ملاحظات = «يوم مستقر»", () => {
  const items = analyze({
    period: "day",
    date: "2026-11-17",
    shopName: "محل",
    summary: summary(base, base),
  });
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ tone: "good", title: "يوم مستقر" });
});

test("التحليل: البيع الآجل والاعتماد على صنف واحد", () => {
  const items = analyze({
    period: "week",
    date: "2026-11-20",
    shopName: "محل",
    summary: summary({ ...base, cash: 600_000, credit: 400_000 }, null),
    top: [
      {
        key: "k",
        name: "سكر",
        unit: "كجم",
        qty: 1,
        revenue: 300_000,
        branches: 1,
      },
    ],
  });
  const titles = items.map((i) => i.title);
  expect(titles).toContain("40% من البيع آجل");
  expect(titles).toContain("«سكر» = 30% من الإيراد");
});
