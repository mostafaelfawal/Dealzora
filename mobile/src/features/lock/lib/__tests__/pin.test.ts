import { lockoutMs, pinProblem } from "../pin";

test("الرمز: أرقام فقط وطول من 4 إلى 8", () => {
  expect(pinProblem("4829")).toBeNull();
  expect(pinProblem("27391846")).toBeNull();
  expect(pinProblem("482")).not.toBeNull();
  expect(pinProblem("482915736")).not.toBeNull();
  expect(pinProblem("48a9")).toBe("أرقام فقط");
});

test("الرمز: يرفض السهل التخمين", () => {
  expect(pinProblem("0000")).toMatch(/تكرر/);
  expect(pinProblem("1234")).toMatch(/متتالية/);
  expect(pinProblem("987654")).toMatch(/متتالية/);
  expect(pinProblem("9012")).toMatch(/متتالية/);
});

test("الانتظار يبدأ بعد 5 أخطاء ويتضاعف بحد أقصى 15 دقيقة", () => {
  expect(lockoutMs(4)).toBe(0);
  expect(lockoutMs(5)).toBe(30_000);
  expect(lockoutMs(6)).toBe(60_000);
  expect(lockoutMs(9)).toBe(480_000);
  expect(lockoutMs(20)).toBe(15 * 60_000);
});
