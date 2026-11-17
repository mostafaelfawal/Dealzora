import { safeRoute } from "../routes";

test("روابط التنبيهات المعروفة فقط", () => {
  expect(safeRoute("/alerts")).toBe("/alerts");
  expect(safeRoute("/receipts")).toBe("/receipts");
  expect(safeRoute("/transfer/3f2a9c1e-0000-4000-8000-000000000001")).toBe(
    "/transfer/3f2a9c1e-0000-4000-8000-000000000001",
  );
  expect(safeRoute("/branch/aaaaaaaa-0000")).toBe("/branch/aaaaaaaa-0000");
  expect(safeRoute("https://evil.example.com")).toBeNull();
  expect(safeRoute("/login")).toBeNull();
  expect(safeRoute("/transfer/../account")).toBeNull();
  expect(safeRoute(undefined)).toBeNull();
  expect(safeRoute(42)).toBeNull();
});

test("رابط الملخص اليومي والأسبوعي", () => {
  expect(safeRoute("/recap/day/2026-11-17")).toBe("/recap/day/2026-11-17");
  expect(safeRoute("/recap/week/2026-11-20")).toBe("/recap/week/2026-11-20");
  expect(safeRoute("/recap/month/2026-11-20")).toBeNull();
  expect(safeRoute("/recap/day/2026-11-17/../../account")).toBeNull();
  expect(safeRoute("/recap/day/17-11-2026")).toBeNull();
});
