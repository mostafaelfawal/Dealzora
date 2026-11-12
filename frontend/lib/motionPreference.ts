"use client";

import { invoke, isTauri } from "@tauri-apps/api/core";
import { MotionGlobalConfig } from "framer-motion";
import { useSyncExternalStore } from "react";

/**
 * الحركة (animations) حسب قوة الجهاز:
 * - auto (الافتراضي): Rust يقرأ الأنوية والرام، ولو الجهاز ضعيف نوقف الحركة.
 * - on / off: اختيار يدوي من الإعدادات ← المظهر.
 *
 * الإيقاف يشمل Framer Motion (MotionGlobalConfig.skipAnimations) وحركات CSS
 * (html[data-reduce-motion] في globals.css). يُحفظ على هذا الجهاز فقط.
 */
export type MotionPreference = "auto" | "on" | "off";

export interface HardwareInfo {
  cpu_cores: number;
  total_memory_mb: number | null;
  low_end: boolean;
}

const PREF_KEY = "dealzora:motion";
// آخر نتيجة فحص، لنطبّقها فوراً عند الفتح التالي قبل ما Rust يرد (بدون وميض حركة).
const LOW_END_KEY = "dealzora:low-end";
const CHANGE_EVENT = "dealzora:motion-change";

let hardware: HardwareInfo | null = null;
let detecting: Promise<void> | null = null;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // التخزين غير متاح: يبقى الإعداد لهذه الجلسة فقط.
  }
}

function readPreference(): MotionPreference {
  const v = read(PREF_KEY);
  return v === "on" || v === "off" ? v : "auto";
}

function isLowEnd(): boolean {
  if (hardware) return hardware.low_end;
  return read(LOW_END_KEY) === "1";
}

function shouldReduce(): boolean {
  const pref = readPreference();
  if (pref !== "auto") return pref === "off";
  return isLowEnd();
}

function apply() {
  const reduce = shouldReduce();
  MotionGlobalConfig.skipAnimations = reduce;
  if (reduce) document.documentElement.dataset.reduceMotion = "";
  else delete document.documentElement.dataset.reduceMotion;
}

/** بديل المتصفح (جهاز كاشير يفتح من المتصفح أو التطوير بدون Tauri). */
function browserHardware(): HardwareInfo {
  const cores = navigator.hardwareConcurrency || 4;
  // deviceMemory تقريبية (0.25…8 جيجا) ومتاحة في Chromium فقط.
  const gb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const memory = gb ? gb * 1024 : null;
  return {
    cpu_cores: cores,
    total_memory_mb: memory,
    low_end: cores <= 2 || (memory !== null && memory < 4096),
  };
}

async function detect() {
  try {
    hardware = isTauri()
      ? await invoke<HardwareInfo>("get_hardware_info")
      : browserHardware();
  } catch {
    hardware = browserHardware();
  }
  write(LOW_END_KEY, hardware.low_end ? "1" : "0");
  notify();
}

function notify() {
  apply();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** يُستدعى مرة واحدة عند بدء التطبيق (MotionProvider). */
export function initMotionPreference() {
  if (typeof window === "undefined") return;
  apply(); // فوراً من آخر نتيجة محفوظة
  detecting ??= detect();
}

export function setMotionPreference(pref: MotionPreference) {
  write(PREF_KEY, pref);
  notify();
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

interface Snapshot {
  preference: MotionPreference;
  reduced: boolean;
  hardware: HardwareInfo | null;
}

let cached: Snapshot | null = null;
function getSnapshot(): Snapshot {
  const next: Snapshot = {
    preference: readPreference(),
    reduced: shouldReduce(),
    hardware,
  };
  if (
    cached &&
    cached.preference === next.preference &&
    cached.reduced === next.reduced &&
    cached.hardware === next.hardware
  ) {
    return cached;
  }
  cached = next;
  return next;
}

const SERVER: Snapshot = { preference: "auto", reduced: false, hardware: null };

export function useMotionPreference() {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
}
