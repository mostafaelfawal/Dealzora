"use client";

import { useSyncExternalStore } from "react";

/**
 * إعدادات طابعة الإيصالات. تُحفظ على الجهاز نفسه (localStorage) لأن كل جهاز كاشير
 * موصّل بطابعته الخاصة.
 *
 * direct: إرسال مباشر للطابعة الحرارية (ESC/POS) بدون نافذة الطباعة.
 * dialog: نافذة الطباعة العادية للنظام (لأي طابعة، أو لو الطابعة لا تدعم ESC/POS).
 */
export type PrintMode = "direct" | "dialog";
export type PaperWidth = 80 | 58;

export interface PrinterPrefs {
  mode: PrintMode;
  /** اسم الطابعة كما في ويندوز. null = لم تُختر بعد (نرجع لنافذة الطباعة). */
  printer: string | null;
  paperMm: PaperWidth;
  /** قص الورق تلقائياً بعد كل إيصال (لو الطابعة فيها قطّاعة). */
  cut: boolean;
  /** فتح درج النقود الموصّل بالطابعة مع البيع النقدي ورد المرتجع نقداً. */
  openDrawer: boolean;
  /** أسطر فارغة قبل القص حتى لا يُقص آخر الإيصال. */
  feedLines: number;
}

export const DEFAULT_PRINTER_PREFS: PrinterPrefs = {
  mode: "direct",
  printer: null,
  paperMm: 80,
  cut: true,
  openDrawer: false,
  feedLines: 4,
};

const STORAGE_KEY = "dealzora:printer:prefs";
const CHANGE_EVENT = "dealzora:printer-prefs-change";

let cache: PrinterPrefs | null = null;

function load(): PrinterPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRINTER_PREFS;
    const saved = { ...DEFAULT_PRINTER_PREFS, ...JSON.parse(raw) } as PrinterPrefs;
    if (saved.paperMm !== 80 && saved.paperMm !== 58) saved.paperMm = 80;
    return saved;
  } catch {
    return DEFAULT_PRINTER_PREFS;
  }
}

export function getPrinterPrefs(): PrinterPrefs {
  if (typeof window === "undefined") return DEFAULT_PRINTER_PREFS;
  cache ??= load();
  return cache;
}

export function setPrinterPrefs(patch: Partial<PrinterPrefs>) {
  cache = { ...getPrinterPrefs(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export function usePrinterPrefs(): PrinterPrefs {
  return useSyncExternalStore(
    subscribe,
    getPrinterPrefs,
    () => DEFAULT_PRINTER_PREFS,
  );
}
