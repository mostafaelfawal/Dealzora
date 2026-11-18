import {
  cleanParams,
  fromQty,
  toCents,
  toMs,
  toMsOrNull,
  toPounds,
  toQty,
} from "@/lib/apiMap";
import { api } from "@/lib/axios";
import { currencySymbol } from "@/lib/currency";

import type {
  OrderFilter,
  OrderStatus,
  ProductFilter,
  StoreBranch,
  StoreOrder,
  StoreOrderDetail,
  StoreOrdersPage,
  StoreProduct,
  StoreProductPatch,
  StoreProductsPage,
  StoreSettings,
  StoreSettingsInput,
  StoreState,
  StoreSummary,
} from "../types/store";

/* شكل sync-server/app/services/store.py (المال بالقروش، الكميات × 1000). */

interface StoreDto {
  slug: string;
  url: string | null;
  name: string;
  tagline: string | null;
  about: string | null;
  phone: string;
  whatsapp: string | null;
  city: string | null;
  address: string | null;
  hours: string | null;
  currency: string;
  logo_image_id: string | null;
  is_published: boolean;
  accepting_orders: boolean;
  delivery_fee: number;
  free_delivery_over: number | null;
  min_order: number;
  delivery_note: string | null;
  fulfillment_branch_id: string | null;
  live: boolean;
  updated_at: string;
}

interface StateDto {
  store: StoreDto | null;
  suggested_name: string;
  suggested_slug: string;
  public_base_url: string | null;
  image_base: string | null;
  branches: {
    id: string;
    name: string;
    code: string;
    is_admin: boolean;
    is_active: boolean;
  }[];
}

interface ProductDto {
  gid: string;
  name: string;
  barcode: string | null;
  category: string | null;
  unit: string;
  allow_decimal: boolean;
  price: number;
  catalog_active: boolean;
  is_published: boolean;
  featured: boolean;
  sort_order: number;
  description: string | null;
  image_id: string | null;
  max_qty: number | null;
  stock_qty: number | null;
  available_qty: number | null;
  stock_at: string | null;
}

interface OrderDto {
  id: string;
  number: number;
  status: OrderStatus;
  customer_name: string;
  phone: string;
  city: string | null;
  address: string;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  items_count: number;
  cancel_reason: string | null;
  cancelled_by: "owner" | "customer" | null;
  owner_note: string | null;
  created_at: string;
  confirmed_at: string | null;
  delivering_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  previous_orders: number;
}

interface OrderDetailDto extends OrderDto {
  lines: {
    gid: string;
    barcode: string | null;
    name: string;
    unit: string;
    unit_price: number;
    qty: number;
    line_total: number;
  }[];
}

const qtyOrNull = (v: number | null) => (v === null ? null : fromQty(v));

const toStore = (d: StoreDto): StoreSettings => ({
  slug: d.slug,
  url: d.url,
  name: d.name,
  tagline: d.tagline,
  about: d.about,
  phone: d.phone,
  whatsapp: d.whatsapp,
  city: d.city,
  address: d.address,
  hours: d.hours,
  logoImageId: d.logo_image_id,
  isPublished: d.is_published,
  acceptingOrders: d.accepting_orders,
  deliveryFee: toPounds(d.delivery_fee),
  freeDeliveryOver:
    d.free_delivery_over === null ? null : toPounds(d.free_delivery_over),
  minOrder: toPounds(d.min_order),
  deliveryNote: d.delivery_note,
  fulfillmentBranchId: d.fulfillment_branch_id,
  live: d.live,
  updatedAt: toMs(d.updated_at),
});

const toBranch = (b: StateDto["branches"][number]): StoreBranch => ({
  id: b.id,
  name: b.name,
  code: b.code,
  isAdmin: b.is_admin,
  isActive: b.is_active,
});

const toProduct = (d: ProductDto): StoreProduct => ({
  gid: d.gid,
  name: d.name,
  barcode: d.barcode,
  category: d.category,
  unit: d.unit,
  allowDecimal: d.allow_decimal,
  price: toPounds(d.price),
  catalogActive: d.catalog_active,
  isPublished: d.is_published,
  featured: d.featured,
  sortOrder: d.sort_order,
  description: d.description,
  imageId: d.image_id,
  maxQty: qtyOrNull(d.max_qty),
  stockQty: qtyOrNull(d.stock_qty),
  availableQty: qtyOrNull(d.available_qty),
  stockAt: d.stock_at ? toMs(d.stock_at) : null,
});

const toOrder = (d: OrderDto): StoreOrder => ({
  id: d.id,
  number: d.number,
  status: d.status,
  customerName: d.customer_name,
  phone: d.phone,
  city: d.city,
  address: d.address,
  notes: d.notes,
  subtotal: toPounds(d.subtotal),
  deliveryFee: toPounds(d.delivery_fee),
  total: toPounds(d.total),
  itemsCount: d.items_count,
  cancelReason: d.cancel_reason,
  cancelledBy: d.cancelled_by,
  ownerNote: d.owner_note,
  createdAt: toMs(d.created_at),
  confirmedAt: toMsOrNull(d.confirmed_at),
  deliveringAt: toMsOrNull(d.delivering_at),
  deliveredAt: toMsOrNull(d.delivered_at),
  cancelledAt: toMsOrNull(d.cancelled_at),
  previousOrders: d.previous_orders ?? 0,
});

const toOrderDetail = (d: OrderDetailDto): StoreOrderDetail => ({
  ...toOrder(d),
  lines: d.lines.map((l) => ({
    gid: l.gid,
    barcode: l.barcode,
    name: l.name,
    unit: l.unit,
    unitPrice: toPounds(l.unit_price),
    qty: fromQty(l.qty),
    lineTotal: toPounds(l.line_total),
  })),
});

/* ---------- الإعدادات ---------- */
export async function fetchStoreState(): Promise<StoreState> {
  const { data } = await api.get<StateDto>("/store");
  return {
    store: data.store ? toStore(data.store) : null,
    suggestedName: data.suggested_name,
    suggestedSlug: data.suggested_slug,
    publicBaseUrl: data.public_base_url,
    imageBase: data.image_base,
    branches: data.branches.map(toBranch),
  };
}

const blank = (v: string | null | undefined) =>
  v && v.trim() ? v.trim() : null;

export async function saveStore(v: StoreSettingsInput): Promise<StoreSettings> {
  const { data } = await api.put<StoreDto>("/store", {
    slug: v.slug.trim().toLowerCase(),
    name: v.name.trim(),
    tagline: blank(v.tagline),
    about: blank(v.about),
    phone: v.phone.trim(),
    whatsapp: blank(v.whatsapp),
    city: blank(v.city),
    address: blank(v.address),
    hours: blank(v.hours),
    currency: currencySymbol().slice(0, 8) || "ج.م",
    logo_image_id: v.logoImageId,
    is_published: v.isPublished,
    accepting_orders: v.acceptingOrders,
    delivery_fee: toCents(v.deliveryFee),
    free_delivery_over:
      v.freeDeliveryOver === null ? null : toCents(v.freeDeliveryOver),
    min_order: toCents(v.minOrder),
    delivery_note: blank(v.deliveryNote),
    fulfillment_branch_id: v.fulfillmentBranchId,
  });
  return toStore(data);
}

export async function checkSlug(
  slug: string,
): Promise<{ slug: string; available: boolean; message: string | null }> {
  const { data } = await api.get("/store/slug", { params: { slug } });
  return data;
}

export async function uploadStoreImage(v: {
  contentType: "image/webp" | "image/jpeg" | "image/png";
  base64: string;
}): Promise<{ id: string; size: number }> {
  const { data } = await api.post(
    "/store/images",
    { content_type: v.contentType, data: v.base64 },
    { timeout: 60_000 },
  );
  return data;
}

/* ---------- الأصناف ---------- */
export async function fetchStoreProducts(params: {
  q?: string;
  status: ProductFilter;
  category?: string;
  page: number;
  pageSize: number;
}): Promise<StoreProductsPage> {
  const { data } = await api.get<{
    items: ProductDto[];
    total: number;
    page: number;
    page_size: number;
    published_count: number;
    categories: string[];
    stock_branch: string | null;
  }>("/store/products", {
    params: cleanParams({
      q: params.q,
      status: params.status,
      category: params.category,
      page: params.page,
      page_size: params.pageSize,
    }),
  });
  return {
    items: data.items.map(toProduct),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    publishedCount: data.published_count,
    categories: data.categories,
    stockBranch: data.stock_branch,
  };
}

export async function updateStoreProduct(
  gid: string,
  patch: StoreProductPatch,
): Promise<StoreProduct> {
  const body: Record<string, unknown> = {};
  if (patch.isPublished !== undefined) body.is_published = patch.isPublished;
  if (patch.featured !== undefined) body.featured = patch.featured;
  if (patch.sortOrder !== undefined) body.sort_order = patch.sortOrder;
  if (patch.description !== undefined)
    body.description = blank(patch.description);
  if (patch.imageId !== undefined) body.image_id = patch.imageId;
  if (patch.maxQty !== undefined)
    body.max_qty = patch.maxQty === null ? null : toQty(patch.maxQty);
  const { data } = await api.patch<ProductDto>(
    `/store/products/${encodeURIComponent(gid)}`,
    body,
  );
  return toProduct(data);
}

export async function bulkPublish(v: {
  gids: string[];
  isPublished: boolean;
}): Promise<{ changed: number; skipped: number }> {
  const { data } = await api.post("/store/products/bulk", {
    gids: v.gids,
    is_published: v.isPublished,
  });
  return data;
}

/* ---------- الطلبات ---------- */
export async function fetchStoreOrders(params: {
  status: OrderFilter;
  q?: string;
  page: number;
  pageSize: number;
}): Promise<StoreOrdersPage> {
  const { data } = await api.get<{
    items: OrderDto[];
    total: number;
    page: number;
    page_size: number;
    counts: Record<OrderStatus, number>;
  }>("/store/orders", {
    params: cleanParams({
      status: params.status,
      q: params.q,
      page: params.page,
      page_size: params.pageSize,
    }),
  });
  return {
    items: data.items.map(toOrder),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    counts: data.counts,
  };
}

export async function fetchStoreOrder(id: string): Promise<StoreOrderDetail> {
  const { data } = await api.get<OrderDetailDto>(
    `/store/orders/${encodeURIComponent(id)}`,
  );
  return toOrderDetail(data);
}

export async function setOrderStatus(
  id: string,
  v: {
    status: Exclude<OrderStatus, "new">;
    reason?: string;
    note?: string | null;
  },
): Promise<StoreOrderDetail> {
  const { data } = await api.post<OrderDetailDto>(
    `/store/orders/${encodeURIComponent(id)}/status`,
    {
      status: v.status,
      ...(v.reason ? { reason: v.reason.trim() } : {}),
      ...(v.note !== undefined ? { note: blank(v.note) } : {}),
    },
  );
  return toOrderDetail(data);
}

export async function setOrderNote(
  id: string,
  note: string | null,
): Promise<StoreOrderDetail> {
  const { data } = await api.put<OrderDetailDto>(
    `/store/orders/${encodeURIComponent(id)}/note`,
    { note: blank(note) },
  );
  return toOrderDetail(data);
}

/* ---------- الملخص ---------- */
export async function fetchStoreSummary(): Promise<StoreSummary> {
  const offset = -new Date().getTimezoneOffset();
  const { data } = await api.get<{
    counts: Record<OrderStatus, number>;
    today_orders: number;
    today_sales: number;
    week_sales: number;
    week_orders: number;
    month_delivered: number;
    average_order: number;
    published_products: number;
    out_of_stock: number;
    daily: { day: string; orders: number; sales: number }[];
    top_products: { gid: string; name: string; qty: number; sales: number }[];
    recent: OrderDto[];
  }>("/store/summary", { params: { utc_offset_minutes: offset } });
  return {
    counts: data.counts,
    todayOrders: data.today_orders,
    todaySales: toPounds(data.today_sales),
    weekSales: toPounds(data.week_sales),
    weekOrders: data.week_orders,
    monthDelivered: toPounds(data.month_delivered),
    averageOrder: toPounds(data.average_order),
    publishedProducts: data.published_products,
    outOfStock: data.out_of_stock,
    daily: data.daily.map((d) => ({ ...d, sales: toPounds(d.sales) })),
    topProducts: data.top_products.map((p) => ({
      ...p,
      qty: fromQty(p.qty),
      sales: toPounds(p.sales),
    })),
    recent: data.recent.map(toOrder),
  };
}
