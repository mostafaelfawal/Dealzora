export type StockLevel = "ok" | "low" | "out";

export interface PosCategory {
  id: string;
  label: string;
}

/** وحدة بيع إضافية (كرتونة، دستة…). المخزون دائماً بالوحدة الأساسية. */
export interface PosUnit {
  id: string;
  name: string;
  /** عدد الوحدات الأساسية فيها (كرتونة 12 = 12). */
  factor: number;
  /** سعر الوحدة بالجنيه. */
  price: number;
  barcode: string;
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
  /** وحدات البيع الإضافية. */
  units: PosUnit[];
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
  /** وحدة البيع الإضافية. null/غائب = الوحدة الأساسية (والفواتير المحفوظة قبل دعم الوحدات). */
  unitId?: string | null;
  /** الوحدات الأساسية في وحدة البيع (1 للأساسية). */
  factor?: number;
  name: string;
  barcode: string;
  /** اسم وحدة البيع. */
  unit: string;
  /** سعر وحدة البيع. */
  price: number;
  qty: number;
  allowDecimal: boolean;
  /** رصيد الصنف بالوحدة الأساسية. */
  stock: number;
  /** خصم على السطر بالجنيه (مبلغ ثابت). */
  discount?: number;
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

/** فاتورة معلّقة على الجهاز الأساسي (تظهر لكل الأجهزة، وتُحذف عند قفل ورديتها). */
export interface HeldInvoice {
  id: string;
  heldAt: number;
  invoice: PosInvoice;
  cashierName?: string | null;
  /** الجهاز الذي عُلّقت عليه (الأساسي أو كاشير 2…). */
  deviceName?: string | null;
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

/** صنف في فاتورة مكتملة (سعره وقت البيع، لا السعر الحالي). */
export interface SoldLine {
  /** id سطر الفاتورة في الـ backend (المرتجع يُرسل به). */
  lineId: string;
  productId: string;
  name: string;
  barcode: string;
  unit: string;
  price: number;
  qty: number;
  /** ما سبق إرجاعه من هذا السطر. */
  returnedQty: number;
  allowDecimal: boolean;
  /** الوحدات الأساسية في وحدة البيع (1 للأساسية). */
  factor: number;
  /** null = الوحدة الأساسية. */
  unitId: string | null;
}

/** فاتورة مكتملة (للقراءة فقط، لا تُعدَّل أبداً). */
export interface CompletedInvoice {
  id: string;
  number: number;
  soldAt: number;
  customer: PosCustomer | null;
  /** نسبة خصم الفاتورة من 0 إلى 1، ليُحسب المرتجع بالسعر الفعلي المدفوع. */
  discountRate: number;
  lines: SoldLine[];
}

export type ReturnReason =
  "wrong_item" | "defective" | "customer_changed" | "other";

export interface ReturnLine {
  lineId: string;
  productId: string;
  /** الوحدات الأساسية في وحدة البيع (لإرجاع الرصيد المحلي). */
  factor: number;
  name: string;
  unit: string;
  price: number;
  qty: number;
  allowDecimal: boolean;
}

/** مسودة الاستبدال/المرتجع المرتبطة بالفاتورة الأصلية. */
export interface ExchangeDraft {
  invoiceId: string;
  invoiceNumber: number;
  discountRate: number;
  reason: ReturnReason;
  lines: ReturnLine[];
}

export type SettlementKind = "collect" | "refund" | "even";
