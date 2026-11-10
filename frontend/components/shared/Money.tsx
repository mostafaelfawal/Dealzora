import { useCurrency } from "@/lib/currency";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MoneyProps {
  amount: number;
  className?: string;
}

/** مبلغ بخط mono وأرقام متراصة، والعملة دايماً ظاهرة. */
export function Money({ amount, className }: MoneyProps) {
  const { symbol } = useCurrency();
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span dir="ltr" className="font-mono font-medium tabular-nums">
        {formatNumber(amount)}
      </span>
      <span className="text-xs text-muted-foreground">{symbol}</span>
    </span>
  );
}
