import type { ReturnReason } from "../types/pos";

export const RETURN_WINDOW_DAYS = 14;

export const RETURN_REASONS: { id: ReturnReason; label: string }[] = [
  { id: "wrong_item", label: "صنف خاطئ" },
  { id: "defective", label: "تالف / معيب" },
  { id: "customer_changed", label: "غيّر رأيه" },
  { id: "other", label: "أخرى" },
];
