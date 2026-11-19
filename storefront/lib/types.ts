/** شكل الواجهة العامة لسيرفر الفروع (sync-server/app/services/store_public.py).
 *  المال بالقروش، والكميات × 1000، كما يرسلها السيرفر. التحويل للعرض في lib/format.ts فقط. */

export interface PublicProduct {
  gid: string;
  name: string;
  price: number;
  unit: string;
  /** خطوة الكمية × 1000: 1000 للعدد، 250 للموزون. */
  step: number;
  category: string | null;
  image_url: string | null;
  featured: boolean;
  available: boolean;
  max_qty: number | null;
  low_stock: boolean;
}

export interface PublicProductDetail extends PublicProduct {
  description: string | null;
  barcode: string | null;
  /** الرئيسية أولاً ثم الإضافية. */
  images: string[];
}

export interface PublicTheme {
  color: string;
  mode: "system" | "light" | "dark";
  cover_url: string | null;
  announcement: string | null;
  show_featured: boolean;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
}

export interface PublicStore {
  slug: string;
  name: string;
  tagline: string | null;
  about: string | null;
  phone: string;
  whatsapp: string | null;
  city: string | null;
  address: string | null;
  hours: string | null;
  currency: string;
  logo_url: string | null;
  accepting_orders: boolean;
  delivery_fee: number;
  free_delivery_over: number | null;
  min_order: number;
  delivery_note: string | null;
  categories: { name: string; count: number }[];
  featured: PublicProduct[];
  products_count: number;
  theme: PublicTheme;
}

export interface ProductsPage {
  items: PublicProduct[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProductPage {
  product: PublicProductDetail;
  related: PublicProduct[];
}

export type SortKey = "default" | "price_asc" | "price_desc" | "name";

export interface QuoteLine {
  gid: string;
  name: string;
  unit: string;
  unit_price: number;
  qty: number;
  line_total: number;
  step: number;
  max_qty: number | null;
  image_url: string | null;
}

export interface CartIssue {
  gid: string;
  code: "product_unavailable" | "out_of_stock" | "qty_exceeds" | "qty_invalid";
  message: string;
  max_qty: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  min_order: number;
  free_delivery_over: number | null;
  accepting_orders: boolean;
  issues: CartIssue[];
}

export type OrderStatus =
  | "new"
  | "confirmed"
  | "delivering"
  | "delivered"
  | "cancelled";

export interface TrackedOrder {
  number: number;
  store_name: string;
  currency: string;
  status: OrderStatus;
  customer_name: string;
  phone: string;
  city: string | null;
  address: string;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  cancel_reason: string | null;
  cancelled_by: "owner" | "customer" | null;
  can_cancel: boolean;
  created_at: string;
  confirmed_at: string | null;
  delivering_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  lines: {
    gid: string;
    name: string;
    unit: string;
    unit_price: number;
    qty: number;
    line_total: number;
  }[];
}

export interface OrderCreated {
  number: number;
  token: string;
  status: OrderStatus;
  total: number;
  created_at: string;
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}
