import { cashTone, expiryText, parseMoneyInput } from "../reportText";

const TODAY = new Date(2026, 10, 16, 15, 0);

test("cashTone", () => {
  expect(cashTone({ difference: -7500 })).toBe("short");
  expect(cashTone({ difference: 200 })).toBe("over");
  expect(cashTone({ difference: 0 })).toBe("ok");
});

test.each([
  ["2026-11-16", "ينتهي اليوم"],
  ["2026-11-26", "ينتهي بعد 10 أيام"],
  ["2026-11-17", "ينتهي بعد يوم"],
  ["2026-11-14", "منتهي منذ يومين"],
])("expiryText %s", (iso, text) => {
  expect(expiryText(iso, TODAY)).toBe(text);
});

test("parseMoneyInput: جنيه ← قروش", () => {
  expect(parseMoneyInput("50")).toBe(5000);
  expect(parseMoneyInput("١٢٫٥")).toBe(1250);
  expect(parseMoneyInput("")).toBe(0);
  expect(parseMoneyInput("1.234")).toBeNull();
  expect(parseMoneyInput("abc")).toBeNull();
});
