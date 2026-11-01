"use client";

import { useShellData } from "@/hooks/useShellData";

import { PosNoShift } from "./posNoShift";
import { PosWorkspace } from "./posWorkspace";

/** بوابة الكاشير: لازم وردية مفتوحة، وبعدها الشاشة الفعلية. */
export function PosScreen() {
  const { shift } = useShellData();
  return shift ? <PosWorkspace /> : <PosNoShift />;
}
