"use client";

import { shellMock } from "@/components/mocks/shell-data";

/**
 * مصدر بيانات الـ Header والـ Sidebar.
 * حالياً بيانات تجريبية؛ استبدلها لاحقاً بالـ API أو الـ store الحقيقي
 * وباقي المكونات مش هتتغير.
 */
export function useShellData() {
  return shellMock;
}
