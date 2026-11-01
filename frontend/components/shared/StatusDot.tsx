import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground",
};

interface StatusDotProps {
  tone: StatusTone;
  pulse?: boolean;
  className?: string;
}

/** نقطة حالة صغيرة. دايماً بتتحط جنب نص (اللون وحده مش كفاية). */
export function StatusDot({ tone, pulse = false, className }: StatusDotProps) {
  return (
    <span
      aria-hidden
      className={cn("relative flex size-2 shrink-0", className)}
    >
      {pulse && (
        <span
          className={cn(
            "absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping",
            TONE_CLASSES[tone],
          )}
        />
      )}
      <span
        className={cn("relative size-2 rounded-full", TONE_CLASSES[tone])}
      />
    </span>
  );
}
