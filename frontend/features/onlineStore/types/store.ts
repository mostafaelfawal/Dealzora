/** المتجر الإلكتروني في الواجهة: المال بالجنيه، والكميات بالوحدة (لا × 1000)، والتواريخ ms. */

export type OrderStatus =
  "new" | "confirmed" | "delivering" | "delivered" | "cancelled";

export type OrderFilter = "open" | OrderStatus | "all";

export interface StoreBranch {
  id: string;
  name: string;
  code: string;
  isAdmin: boolean;
  isActive: boolean;
}

export interface StoreSettings {
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
  logoImageId: string | null;
  isPublished: boolean;
  acceptingOrders: boolean;
  deliveryFee: number;
  freeDeliveryOver: number | null;
  minOrder: number;
  deliveryNote: string | null;
  fulfillmentBranchId: string | null;
  /** منشور فعلاً للزوار (منشور + الترخيص ساري). */
  live: boolean;
  updatedAt: number;
}

export interface StoreState {
  store: StoreSettings | null;
  suggestedName: string;
  suggestedSlug: string;
  publicBaseUrl: string | null;
  /** أساس روابط الصور للمعاينة (من سيرفر الفروع). */
  imageBase: string | null;
  branches: StoreBranch[];
}

export type StoreSettingsInput = Omit<
  StoreSettings,
  "url" | "live" | "updatedAt"
>;

export interface StoreProduct {
  gid: string;
  name: string;
  barcode: string | null;
  category: string | null;
  unit: string;
  allowDecimal: boolean;
  price: number;
  catalogActive: boolean;
  isPublished: boolean;
  featured: boolean;
  sortOrder: number;
  description: string | null;
  imageId: string | null;
  maxQty: number | null;
  stockQty: number | null;
  availableQty: number | null;
  stockAt: number | null;
}

export interface StoreProductsPage {
  items: StoreProduct[];
  total: number;
  page: number;
  pageSize: number;
  publishedCount: number;
  categories: string[];
  stockBranch: string | null;
}

export type ProductFilter = "all" | "published" | "hidden";

export interface StoreProductPatch {
  isPublished?: boolean;
  featured?: boolean;
  sortOrder?: number;
  description?: string | null;
  imageId?: string | null;
  maxQty?: number | null;
}

export interface StoreOrder {
  id: string;
  number: number;
  status: OrderStatus;
  customerName: string;
  phone: string;
  city: string | null;
  address: string;
  notes: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemsCount: number;
  cancelReason: string | null;
  cancelledBy: "owner" | "customer" | null;
  ownerNote: string | null;
  createdAt: number;
  confirmedAt: number | null;
  deliveringAt: number | null;
  deliveredAt: number | null;
  cancelledAt: number | null;
  previousOrders: number;
}

export interface StoreOrderLine {
  gid: string;
  barcode: string | null;
  name: string;
  unit: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface StoreOrderDetail extends StoreOrder {
  lines: StoreOrderLine[];
}

export interface StoreOrdersPage {
  items: StoreOrder[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<OrderStatus, number>;
}

export interface StoreSummary {
  counts: Record<OrderStatus, number>;
  todayOrders: number;
  todaySales: number;
  weekSales: number;
  weekOrders: number;
  monthDelivered: number;
  averageOrder: number;
  publishedProducts: number;
  outOfStock: number;
  daily: { day: string; orders: number; sales: number }[];
  topProducts: { gid: string; name: string; qty: number; sales: number }[];
  recent: StoreOrder[];
}
