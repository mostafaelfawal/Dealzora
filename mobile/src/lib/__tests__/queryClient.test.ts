import type { Query } from "@tanstack/react-query";

import { shouldPersistQuery } from "../queryClient";

jest.mock("expo-network", () => ({ addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })) }));
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

const q = (queryKey: unknown[]) => ({ queryKey, state: { status: "success" } }) as unknown as Query;

test("بيانات أمان المالك والأسعار لا تُحفظ على الهاتف", () => {
  expect(shouldPersistQuery(q(["security", "staff"]))).toBe(false);
  expect(shouldPersistQuery(q(["prices", "search", "زيت"]))).toBe(false);
  expect(shouldPersistQuery(q(["reports", "config"]))).toBe(false);
  expect(shouldPersistQuery(q(["summary", "2026-11-16", "2026-11-16", "all"]))).toBe(true);
  expect(shouldPersistQuery(q(["reports", "shortages"]))).toBe(true);
});
