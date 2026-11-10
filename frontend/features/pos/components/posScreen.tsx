"use client";

import { IconLoader2 } from "@tabler/icons-react";

import { useShellData } from "@/hooks/useShellData";

import { PosNoShift } from "./posNoShift";
import { PosWorkspace } from "./posWorkspace";

/** بوابة الكاشير: يلزم وجود وردية مفتوحة، وبعدها تظهر الشاشة الفعلية. */
export function PosScreen() {
  const { shift, isShiftLoading } = useShellData();
  if (isShiftLoading) {
    return (
      <main className="flex h-dvh items-center justify-center text-muted-foreground">
        <IconLoader2 className="size-6 animate-spin" aria-label="جارٍ التحميل" />
      </main>
    );
  }
  return shift ? <PosWorkspace /> : <PosNoShift />;
}
