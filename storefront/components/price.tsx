import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

/** مبلغ بخط ثابت العرض وأرقام لاتينية، والعملة بخط أصغر (نفس <Money /> في البرنامج). */
export function Price({
  cents,
  currency,
  className,
}: {
  cents: number;
  currency: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span dir="ltr" className="font-mono font-semibold tabular-nums">
        {formatAmount(cents)}
      </span>
      <span className="text-[0.75em] text-muted-foreground">{currency}</span>
    </span>
  );
}
