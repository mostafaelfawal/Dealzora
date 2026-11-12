export type PromoKind = "percent" | "amount" | "buy_get";
export type PromoScope = "all" | "category" | "products";
export type PromoStatus = "active" | "scheduled" | "expired" | "paused";

export interface Promotion {
  id: string;
  name: string;
  kind: PromoKind;
  /** percent: النسبة. amount: المبلغ بالجنيه على كل قطعة. */
  value: number;
  buyQty: number | null;
  getQty: number | null;
  /** أقل كمية في السطر ليُطبق الخصم (null = أي كمية). */
  minQty: number | null;
  scope: PromoScope;
  categoryId: string | null;
  categoryName: string | null;
  productIds: string[];
  productNames: string[];
  /** YYYY-MM-DD */
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
  status: PromoStatus;
  version: number;
}

export interface PromotionInput {
  name: string;
  kind: PromoKind;
  value: number;
  buyQty: number | null;
  getQty: number | null;
  minQty: number | null;
  scope: PromoScope;
  categoryId: string | null;
  productIds: string[];
  startsOn: string | null;
  endsOn: string | null;
  isActive: boolean;
}

export interface PromotionsSummary {
  active: number;
  scheduled: number;
  expired: number;
  paused: number;
}
