"use client";

import {
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";

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
  /**
   * لو true الـ tooltip مايظهرش غير لو النص فعلاً اتقطع (truncate)،
   * يعني عرض المحتوى أكبر من العرض المتاح للعنصر.
   */
  onlyWhenTruncated?: boolean;
  /** عنصر واحد بس (زر، رابط...) وهو اللي هيشغّل الـ tooltip. */
  children: ReactElement;
}

function isTruncated(el: HTMLElement | null) {
  if (!el) return false;
  return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
}

export function AppTooltip({
  message,
  side = "bottom",
  disabled = false,
  onlyWhenTruncated = false,
  children,
}: AppTooltipProps) {
  const triggerRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  if (disabled || message == null || message === "") return children;

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) =>
        setOpen(next && (!onlyWhenTruncated || isTruncated(triggerRef.current)))
      }
    >
      {/* الـ trigger بيتعرض كأي عنصر (span، td...) مش زر بس، فالـ ref عام. */}
      <TooltipTrigger
        ref={triggerRef as Ref<HTMLButtonElement>}
        render={children}
      />
      <TooltipContent side={side}>{message}</TooltipContent>
    </Tooltip>
  );
}
