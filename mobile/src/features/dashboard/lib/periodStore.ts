/**
 * الفترة المختارة (مشتركة بين الرئيسية وتفاصيل الفرع). تبدأ «اليوم» مع كل فتح للتطبيق،
 * والفترات الجاهزة تُحسب من تاريخ الهاتف لحظة القراءة (فتجاوز منتصف الليل يغيّر «اليوم» تلقائياً).
 */
import { useSyncExternalStore } from "react";

import { presetRange, type DateRange, type PeriodPreset } from "@/lib/period";

interface PeriodState {
  preset: PeriodPreset;
  /** للفترة المخصصة فقط. */
  custom: DateRange | null;
}

let state: PeriodState = { preset: "today", custom: null };
const listeners = new Set<() => void>();

const get = () => state;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function setPreset(preset: Exclude<PeriodPreset, "custom">): void {
  state = { preset, custom: state.custom };
  listeners.forEach((fn) => fn());
}

export function setCustomRange(range: DateRange): void {
  state = { preset: "custom", custom: range };
  listeners.forEach((fn) => fn());
}

export function resolveRange(s: PeriodState, now = new Date()): DateRange {
  if (s.preset === "custom" && s.custom) return s.custom;
  return presetRange(s.preset === "custom" ? "today" : s.preset, now);
}

export function usePeriod(): { preset: PeriodPreset; range: DateRange } {
  const s = useSyncExternalStore(subscribe, get, get);
  return { preset: s.preset, range: resolveRange(s) };
}
