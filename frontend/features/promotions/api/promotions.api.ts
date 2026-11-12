import { fromQty, toCents, toPounds, toQty } from "@/lib/apiMap";
import { api } from "@/lib/axios";

import type {
  Promotion,
  PromotionInput,
  PromotionsSummary,
} from "../types/promotion";

interface PromotionDto {
  id: string;
  name: string;
  kind: Promotion["kind"];
  value: number;
  buy_qty: number | null;
  get_qty: number | null;
  min_qty: number | null;
  scope: Promotion["scope"];
  category_id: string | null;
  category_name: string | null;
  product_ids: string[];
  product_names: string[];
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  status: Promotion["status"];
  version: number;
}

const toPromotion = (d: PromotionDto): Promotion => ({
  id: d.id,
  name: d.name,
  kind: d.kind,
  value: d.kind === "amount" ? toPounds(d.value) : d.value,
  buyQty: d.buy_qty,
  getQty: d.get_qty,
  minQty: d.min_qty === null ? null : fromQty(d.min_qty),
  scope: d.scope,
  categoryId: d.category_id,
  categoryName: d.category_name,
  productIds: d.product_ids,
  productNames: d.product_names,
  startsOn: d.starts_on,
  endsOn: d.ends_on,
  isActive: d.is_active,
  status: d.status,
  version: d.version,
});

const toBody = (i: PromotionInput) => ({
  name: i.name.trim(),
  kind: i.kind,
  value: i.kind === "amount" ? toCents(i.value) : Math.round(i.value),
  buy_qty: i.kind === "buy_get" ? i.buyQty : null,
  get_qty: i.kind === "buy_get" ? i.getQty : null,
  min_qty: i.kind !== "buy_get" && i.minQty ? toQty(i.minQty) : null,
  scope: i.scope,
  category_id: i.scope === "category" ? i.categoryId : null,
  product_ids: i.scope === "products" ? i.productIds : [],
  starts_on: i.startsOn || null,
  ends_on: i.endsOn || null,
  is_active: i.isActive,
});

export const fetchPromotions = async (): Promise<Promotion[]> =>
  (await api.get<PromotionDto[]>("/promotions")).data.map(toPromotion);

export const fetchPromotionsSummary = async (): Promise<PromotionsSummary> =>
  (await api.get<PromotionsSummary>("/promotions/summary")).data;

export const createPromotion = async (input: PromotionInput) =>
  toPromotion(
    (await api.post<PromotionDto>("/promotions", toBody(input))).data,
  );

export const updatePromotion = async (p: Promotion, input: PromotionInput) =>
  toPromotion(
    (
      await api.put<PromotionDto>(`/promotions/${p.id}`, {
        ...toBody(input),
        base_version: p.version,
      })
    ).data,
  );

export const togglePromotion = async (p: Promotion) =>
  toPromotion(
    (
      await api.post<PromotionDto>(`/promotions/${p.id}/toggle`, null, {
        params: { base_version: p.version },
      })
    ).data,
  );

export const deletePromotion = async (p: Promotion) => {
  await api.delete(`/promotions/${p.id}`, {
    params: { base_version: p.version },
  });
};
