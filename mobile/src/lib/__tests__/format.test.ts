import { formatPairingCode, formatPiastres, formatTimeAgo } from "../format";

const NOW = Date.parse("2026-11-15T10:00:00Z");
const ago = (ms: number) => NOW - ms;

describe("formatTimeAgo", () => {
  test.each([
    [10_000, "الآن"],
    [60_000, "منذ دقيقة"],
    [2 * 60_000, "منذ دقيقتين"],
    [5 * 60_000, "منذ 5 دقائق"],
    [15 * 60_000, "منذ 15 دقيقة"],
    [3 * 3_600_000, "منذ 3 ساعات"],
    [2 * 86_400_000, "منذ يومين"],
  ])("%d ms → %s", (ms, expected) => {
    expect(formatTimeAgo(ago(ms), NOW)).toBe(expected);
  });
});

test("formatPairingCode يقبل الأرقام العربية والحروف الصغيرة", () => {
  expect(formatPairingCode("k7qm٤xwt9hna")).toBe("K7QM-4XWT-9HNA");
  expect(formatPairingCode("K7QM-4X")).toBe("K7QM-4X");
  expect(formatPairingCode("K7QM4XWT9HNAZZZ")).toBe("K7QM-4XWT-9HNA");
});

test("formatPiastres: القروش للعرض فقط", () => {
  expect(formatPiastres(125000)).toBe("1,250.00");
  expect(formatPiastres(5)).toBe("0.05");
});
