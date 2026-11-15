import type { BranchTotals, Summary, Totals } from "@/api/types";

import {
  branchCoverage,
  change,
  coverageLabel,
  formatChange,
  missingBranches,
  statusText,
  syncLagText,
} from "../insights";

const ZERO: Totals = {
  count: 0, revenue: 0, returns: 0, net: 0, cost: 0, profit: 0, discounts: 0, cash: 0, credit: 0, wallet: 0,
  expenses: 0, eta_waiting: 0, eta_accepted: 0, eta_rejected: 0, net_profit: 0,
};

const branch = (over: Partial<BranchTotals>): BranchTotals => ({
  ...ZERO, id: "b", name: "فرع", code: "B", is_active: true, last_update: null, reported_days: 1, expected_days: 1,
  ...over,
});

describe("change", () => {
  test("نسبة بعلامة ورقم عشري واحد", () => {
    expect(change(112_500, 100_000)).toEqual({ pct: 12.5, diff: 12_500, direction: "up" });
    expect(formatChange(change(112_500, 100_000))).toBe("+12.5%");
    expect(formatChange(change(97, 100))).toBe("−3%");
  });
  test("المقارنة بصفر: لا نسبة", () => {
    expect(change(500, 0).pct).toBeNull();
    expect(formatChange(change(500, 0))).toBeNull();
    expect(formatChange(change(0, 0))).toBe("بدون تغيير");
  });
  test("السابق سالب (مرتجعات أكبر من المبيعات)", () => {
    expect(change(100, -100)).toMatchObject({ pct: 200, direction: "up" });
  });
});

describe("التغطية: فرع لم يرسل ≠ صفر مبيعات", () => {
  test("الحالات", () => {
    expect(branchCoverage(branch({ reported_days: 1, expected_days: 1 }))).toBe("complete");
    expect(branchCoverage(branch({ reported_days: 0, expected_days: 1 }))).toBe("none");
    expect(branchCoverage(branch({ reported_days: 5, expected_days: 7 }))).toBe("partial");
    expect(branchCoverage(branch({ reported_days: 0, expected_days: 0 }))).toBe("complete"); // أُنشئ بعد الفترة
  });
  test("النصوص", () => {
    expect(coverageLabel(branch({ reported_days: 0 }), true)).toBe("لم يرسل بيانات هذا اليوم بعد");
    expect(coverageLabel(branch({ reported_days: 5, expected_days: 7 }), false)).toBe("ناقص يومين من الفترة");
    expect(coverageLabel(branch({}), true)).toBeNull();
  });
  test("missingBranches يتجاهل الفروع الموقوفة", () => {
    const summary = {
      branches: [
        branch({ id: "a" }),
        branch({ id: "b", reported_days: 0 }),
        branch({ id: "c", reported_days: 0, is_active: false }),
      ],
    } as Summary;
    expect(missingBranches(summary).map((b) => b.id)).toEqual(["b"]);
  });
});

test("statusText", () => {
  expect(statusText("online", 30)).toBe("متصل الآن");
  expect(statusText("late", 600)).toBe("متأخر · آخر ظهور منذ 10 دقائق");
  expect(statusText("offline", 3 * 3600)).toBe("منقطع منذ 3 ساعات");
  expect(statusText("offline", 2 * 86400)).toBe("منقطع منذ يومين");
  expect(statusText("never", null)).toBe("لم يتصل بالخادم بعد");
});

test("syncLagText", () => {
  expect(syncLagText(0)).toBeNull();
  expect(syncLagText(6)).toBe("6 تحديثات من الفروع الأخرى لم يصل له بعد");
});
