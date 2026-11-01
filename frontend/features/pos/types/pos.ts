export type StockLevel = "ok" | "low" | "out";

export interface PosCategory {
  id: string;
  label: string;
}

export interface PosProduct {
  id: string;
  name: string;
  barcode: string;
  category: string;
  /** سعر الوحدة بالجنيه. */
  price: number;
  unit: string;
  /** true للأصناف بالوزن (كجم) اللي بتقبل كسور. */
  allowDecimal: boolean;
  stock: number;
  /** الحد الأدنى للمخزون (تحته يظهر تنبيه "باقي قليل"). */
  minStock: number;
}

export interface PosCustomer {
  id: string;
  name: string;
  phone: string;
  /** المديونية الحالية على العميل. */
  balance: number;
  /** الحد الائتماني. 0 = مفيش بيع آجل للعميل ده. */
  creditLimit: number;
}

/** صنف جوه الفاتورة (نسخة من بيانات الصنف وقت الإضافة). */
export interface CartLine {
  productId: string;
  name: string;
  barcode: string;
  unit: string;
  price: number;
  qty: number;
  allowDecimal: boolean;
  stock: number;
}

export type DiscountType = "amount" | "percent";

export interface InvoiceDiscount {
  type: DiscountType;
  value: number;
}

export interface PosInvoice {
  lines: CartLine[];
  customer: PosCustomer | null;
  discount: InvoiceDiscount | null;
}

export interface HeldInvoice {
  id: string;
  heldAt: number;
  invoice: PosInvoice;
}

export type PaymentMethod = "cash" | "credit" | "mixed";

export interface PaymentResult {
  method: PaymentMethod;
  /** اللي العميل سلّمه فعلاً (كاش). */
  received: number;
  /** الجزء المدفوع كاش من الفاتورة. */
  cash: number;
  /** الجزء الآجل على حساب العميل. */
  credit: number;
  /** الباقي اللي يرجع للعميل. */
  change: number;
  print: boolean;
}
