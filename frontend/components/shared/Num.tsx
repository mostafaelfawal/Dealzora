import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * رقم داخل نص عربي: يُعزل باتجاه LTR وبخط ثابت العرض
 * حتى لا تنقلب الأرقام أو الرموز (/ - %) وسط الجملة.
 */
export function Num({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <bdi dir="ltr" className={cn("font-mono", className)}>
      {children}
    </bdi>
  );
}
