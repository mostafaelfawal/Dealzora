import {
  formatDate,
  parseIsoDay,
  todayIso,
  toIsoDay,
  addDays,
} from "@/lib/dates";

/** موعد الاستلام بلغة الكاشير: اليوم، غداً، أو التاريخ. */
export function formatPickup(pickupOn: string | null): string {
  if (!pickupOn) return "بلا موعد";
  if (pickupOn === todayIso()) return "يُستلم اليوم";
  if (pickupOn === toIsoDay(addDays(new Date(), 1))) return "يُستلم غداً";
  return `يُستلم ${formatDate(parseIsoDay(pickupOn))}`;
}
