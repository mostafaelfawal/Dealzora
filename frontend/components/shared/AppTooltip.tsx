import type { ReactElement, ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppTooltipProps {
  /** النص اللي يظهر داخل الـ tooltip. */
  message: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** لو true بيرجّع العنصر من غير tooltip (مفيد لما القائمة تكون موسّعة). */
  disabled?: boolean;
  /** عنصر واحد بس (زر، رابط...) وهو اللي هيشغّل الـ tooltip. */
  children: ReactElement;
}

export function AppTooltip({
  message,
  side = "bottom",
  disabled = false,
  children,
}: AppTooltipProps) {
  if (disabled) return children;

  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{message}</TooltipContent>
    </Tooltip>
  );
}
