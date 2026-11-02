import { RETURN_WINDOW_DAYS } from "../config/posReturn";
import { round2 } from "./posCalc";
import type {
  CompletedInvoice,
  ReturnLine,
  SettlementKind,
  SoldLine,
} from "../types/pos";

const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** المتاح للإرجاع من السطر (المباع − ما سبق إرجاعه). */
export const returnableQty = (line: SoldLine) =>
  Math.max(round3(line.qty - line.returnedQty), 0);

export const soldTotal = (invoice: CompletedInvoice) =>
  round2(
    invoice.lines.reduce((sum, l) => sum + l.price * l.qty, 0) *
      (1 - invoice.discountRate),
  );

export const returnLineValue = (line: ReturnLine, discountRate: number) =>
  round2(line.price * line.qty * (1 - discountRate));

export const returnValue = (lines: ReturnLine[], discountRate: number) =>
  round2(
    lines.reduce((sum, l) => sum + l.price * l.qty, 0) * (1 - discountRate),
  );

export const isReturnExpired = (soldAt: number, now: number) =>
  now - soldAt > RETURN_WINDOW_DAYS * 86_400_000;

/** الفرق بين الأصناف الجديدة والمرتجع. موجب = العميل يدفع، سالب = نرد له. */
export function calcSettlement(newTotal: number, returnTotal: number) {
  const net = round2(newTotal - returnTotal);
  const kind: SettlementKind =
    net > 0 ? "collect" : net < 0 ? "refund" : "even";
  return { newTotal, returnTotal, net, kind };
}
