import { isInsecureRemote, normalizeServerUrl } from "../url";

describe("normalizeServerUrl", () => {
  test.each([
    ["sync.example.com", "https://sync.example.com"],
    ["  https://sync.example.com/ ", "https://sync.example.com"],
    ["https://sync.example.com/v1", "https://sync.example.com"],
    ["https://sync.example.com/mobile/v1/", "https://sync.example.com"],
    ["http://192.168.1.10:8000", "http://192.168.1.10:8000"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeServerUrl(input)).toBe(expected);
  });

  test("فارغ أو غير صالح", () => {
    expect(normalizeServerUrl("")).toBeNull();
    expect(normalizeServerUrl(null)).toBeNull();
    expect(normalizeServerUrl("https://")).toBeNull();
  });
});

describe("isInsecureRemote", () => {
  test("http مسموح للشبكة المحلية فقط", () => {
    expect(isInsecureRemote("http://192.168.1.10:8000")).toBe(false);
    expect(isInsecureRemote("http://10.0.2.2:8000")).toBe(false);
    expect(isInsecureRemote("https://sync.example.com")).toBe(false);
    expect(isInsecureRemote("http://sync.example.com")).toBe(true);
  });
});
