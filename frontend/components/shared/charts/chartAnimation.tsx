"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useMotionPreference } from "@/lib/motionPreference";

import { ANIMATION } from "./chartTheme";

/**
 * حركة رسوم Recharts (نمو الأعمدة، رسم المساحة، دوران الدائرة).
 *
 * تتوقف في حالتين:
 * - «الحركة: إيقاف» من الإعدادات أو جهاز ضعيف (نفس إعداد باقي البرنامج).
 * - داخل <StaticCharts> (مثل تجهيز ملف PDF): الرسم يظهر مكتملاً فوراً. الحركة هنا
 *   تعتمد على requestAnimationFrame الذي لا يتقدم لعنصر خارج الشاشة، فتُلتقط الرسوم
 *   في منتصف حركتها (دائرة فارغة، ومساحة مقصوصة بعرض صفر).
 */
const ChartsAnimated = createContext(true);

const STATIC = { isAnimationActive: false } as const;

export function StaticCharts({ children }: { children: ReactNode }) {
  return (
    <ChartsAnimated.Provider value={false}>{children}</ChartsAnimated.Provider>
  );
}

export function useChartAnimation() {
  const animated = useContext(ChartsAnimated);
  const { reduced } = useMotionPreference();
  return animated && !reduced ? ANIMATION : STATIC;
}
