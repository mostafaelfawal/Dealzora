import { formatQty } from "@/lib/format";
import { formatDate, parseIsoDay } from "@/lib/dates";

import type { Promotion, PromoStatus } from "../types/promotion";

/** «اشتري 2 وخد 1» / «خصم 10%» / «خصم 5 على القطعة». */
export function promoHeadline(
  p: Pick<Promotion, "kind" | "value" | "buyQty" | "getQty">,
): string {
  if (p.kind === "buy_get")
    return `اشترِ ${p.buyQty ?? "؟"} واحصل على ${p.getQty ?? "؟"} مجاناً`;
  if (p.kind === "percent") return `خصم ${p.value}%`;
  return `خصم ${formatQty(p.value)} على كل قطعة`;
}

export function promoScopeText(p: Promotion): string {
  if (p.scope === "all") return "كل الأصناف";
  if (p.scope === "category") return `قسم ${p.categoryName ?? "؟"}`;
  const [first, ...rest] = p.productNames;
  if (!first) return "أصناف محذوفة";
  return rest.length ? `${first} و${rest.length} صنف آخر` : first;
}

export function promoPeriodText(p: Promotion): string {
  const d = (iso: string) => formatDate(parseIsoDay(iso));
  if (p.startsOn && p.endsOn) return `من ${d(p.startsOn)} إلى ${d(p.endsOn)}`;
  if (p.endsOn) return `حتى ${d(p.endsOn)}`;
  if (p.startsOn) return `يبدأ ${d(p.startsOn)}`;
  return "بدون مدة محددة";
}

export const STATUS_INFO: Record<
  PromoStatus,
  { label: string; className: string }
> = {
  active: { label: "مفعّل الآن", className: "bg-success/10 text-success" },
  scheduled: { label: "يبدأ قريباً", className: "bg-primary/10 text-primary" },
  expired: { label: "انتهى", className: "bg-muted text-muted-foreground" },
  paused: { label: "متوقف", className: "bg-warning/15 text-warning" },
};
