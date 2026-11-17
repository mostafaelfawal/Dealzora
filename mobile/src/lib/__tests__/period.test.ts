import { clampCustom, includesToday, presetRange, rangeDays } from "../period";

// 15 نوفمبر 2026، 1 ظهراً بالتوقيت المحلي
const NOW = new Date(2026, 10, 15, 13, 0);

describe("presetRange (نفس تعريفات البرنامج المكتبي)", () => {
  test.each([
    ["today", "2026-11-15", "2026-11-15"],
    ["yesterday", "2026-11-14", "2026-11-14"],
    ["week", "2026-11-09", "2026-11-15"], // آخر 7 أيام
    ["month", "2026-11-01", "2026-11-15"],
  ] as const)("%s", (preset, from, to) => {
    expect(presetRange(preset, NOW)).toEqual({ from, to });
  });

  test("أمس في أول الشهر يرجع للشهر السابق", () => {
    expect(presetRange("yesterday", new Date(2026, 2, 1, 9))).toEqual({
      from: "2026-02-28",
      to: "2026-02-28",
    });
  });
});

test("rangeDays و includesToday", () => {
  expect(rangeDays({ from: "2026-11-09", to: "2026-11-15" })).toBe(7);
  expect(rangeDays({ from: "2026-10-25", to: "2026-10-26" })).toBe(2); // عبر تغيير التوقيت الصيفي
  expect(includesToday({ from: "2026-11-01", to: "2026-11-15" }, NOW)).toBe(
    true,
  );
  expect(includesToday({ from: "2026-11-14", to: "2026-11-14" }, NOW)).toBe(
    false,
  );
});

test("clampCustom: يقلب العكس ويقص لسنة", () => {
  expect(clampCustom(new Date(2026, 10, 15), new Date(2026, 10, 1))).toEqual({
    from: "2026-11-01",
    to: "2026-11-15",
  });
  const long = clampCustom(new Date(2024, 0, 1), new Date(2026, 10, 15));
  expect(rangeDays(long)).toBe(366);
  expect(long.to).toBe("2026-11-15");
});
