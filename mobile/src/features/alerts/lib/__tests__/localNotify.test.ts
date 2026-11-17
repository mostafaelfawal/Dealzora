/** اختيار التنبيهات التي تستحق إشعاراً محلياً (بلا أجهزة). jest.mock يُرفع فوق الـ imports تلقائياً. */
import type { AppNotification } from "@/api/types";

import { pickNew } from "../localNotify";

jest.mock("expo-notifications", () => ({}));
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {},
  ExecutionEnvironment: {},
}));
jest.mock("expo-device", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock("@/api/instance", () => ({ api: {} }));

const NOW = Date.parse("2026-11-16T12:00:00Z");

function n(id: string, over: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    kind: "transfer_request",
    title: "طلب تحويل",
    body: "فرع المعادي يطلب تحويلاً",
    route: "/transfer/1",
    status: "sent",
    created_at: "2026-11-16T11:00:00Z",
    read_at: null,
    ...over,
  };
}

describe("pickNew", () => {
  it("يختار الجديد غير المقروء فقط", () => {
    const out = pickNew(
      [n("a"), n("b", { read_at: "2026-11-16T11:30:00Z" }), n("c")],
      ["c"],
      NOW,
    );
    expect(out.map((x) => x.id)).toEqual(["a"]);
  });

  it("يتجاهل المُسقط والأقدم من 24 ساعة", () => {
    const out = pickNew(
      [
        n("a", { status: "dropped" }),
        n("b", { created_at: "2026-11-15T11:00:00Z" }),
        n("c", { status: "pending" }),
      ],
      [],
      NOW,
    );
    expect(out.map((x) => x.id)).toEqual(["c"]);
  });

  it("لا شيء حين الكل معروف", () => {
    expect(pickNew([n("a"), n("b")], ["a", "b"], NOW)).toEqual([]);
  });
});
