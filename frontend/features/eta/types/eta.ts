/** منظومة الإيصال الإلكتروني (شكل الـ backend كما هو: الحقول snake_case، لا مال ولا كميات). */

export type EtaEnvironment = "preprod" | "prod";
export type EtaItemType = "EGS" | "GS1";
export type SecretState = "unset" | "set" | "unreadable";
export type SecretAction = "keep" | "set" | "clear";

export interface EtaConfig {
  enabled: boolean;
  environment: EtaEnvironment;
  rin: string | null;
  company_trade_name: string | null;
  activity_code: string | null;
}

export interface EtaBranch {
  branch_code: string | null;
  country: string;
  governate: string | null;
  region_city: string | null;
  street: string | null;
  building_number: string | null;
  postal_code: string | null;
  floor: string | null;
  room: string | null;
  landmark: string | null;
  additional_information: string | null;
}

export interface EtaDevice {
  device_id: string;
  name: string;
  is_main: boolean;
  pos_serial: string | null;
  pos_os_version: string | null;
  pos_model_framework: string | null;
  client_id: string | null;
  /** الحالة فقط: السر نفسه لا يرجع من السيرفر أبداً. */
  client_secret: SecretState;
  preshared_key: SecretState;
}

export interface EtaDeviceInput {
  pos_serial: string | null;
  pos_os_version: string | null;
  pos_model_framework: string | null;
  client_id: string | null;
  client_secret_action: SecretAction;
  client_secret: string | null;
  preshared_key_action: SecretAction;
  preshared_key: string | null;
}

export interface EtaUnit {
  id: string;
  name: string;
  eta_unit_type: string | null;
  suggested: string | null;
  product_count: number;
}

export interface EtaCode {
  code: string;
  desc_en: string;
  desc_ar: string;
  ref: string | null;
}

export type CodeTableName =
  | "units"
  | "activities"
  | "tax_types"
  | "non_taxable_tax_types"
  | "tax_subtypes"
  | "payment_methods"
  | "buyer_types";

export type ReadinessSection =
  "tax" | "shop" | "branch" | "devices" | "units" | "products";

export interface ReadinessItem {
  key: string;
  section: ReadinessSection;
  severity: "blocker" | "warning";
  title: string;
  detail: string | null;
  count: number | null;
  samples: string[];
  ref_id: string | null;
}

export interface ConnectionTest {
  ok: boolean;
  environment: EtaEnvironment;
  message: string;
  kind: string | null;
  expires_in: number | null;
  correlation_id: string | null;
}

export interface SendCycle {
  submitted: number;
  accepted: number;
  rejected: number;
  resolved: number;
  errors: string[];
}

export interface SendStatus {
  /** الحالة ← العدد (not_sent/pending/accepted/rejected/invalid/not_required). */
  counts: Record<string, number>;
  /** الطابور: لم يصل بعد، مرفوض، قارب مهلة الـ 24 ساعة، تجاوزها. */
  queue: { waiting: number; rejected: number; late: number; overdue: number };
  devices: Record<
    string,
    {
      wait_seconds: number;
      auth_error: string | null;
      /** رقم مرتجع يوقف سلسلة الجهاز (فاتورته الأصلية مرفوضة) حتى قرار المدير. */
      held_by: string | null;
      held_return_id: string | null;
    }
  >;
}

export interface SendAttempt {
  id: string;
  created_at: string;
  pos_device_id: string;
  environment: EtaEnvironment;
  operation: "test" | "submit" | "poll";
  outcome: string;
  http_status: number | null;
  submission_uuid: string | null;
  receipts_count: number;
  accepted_count: number;
  rejected_count: number;
  retry_after: number | null;
  correlation_id: string | null;
  message: string | null;
  duration_ms: number;
}

export interface Readiness {
  ready: boolean;
  blockers: number;
  warnings: number;
  items: ReadinessItem[];
}

/* ---------- متابعة الإيصالات (المرحلة 8) ---------- */

export type EReceiptStatus =
  "not_sent" | "pending" | "accepted" | "rejected" | "not_required" | "invalid";

/** ماذا يفعل زر «إعادة الإرسال»: تصحيح مرفوض / إعادة توليد خطأ تحقق / إرسال فوري. */
export type ResendMode = "correct" | "regenerate" | "send";

export interface ReceiptItem {
  kind: "sale" | "return";
  id: string;
  /** الفاتورة المرتبطة (للمرتجع: فاتورته الأصلية). */
  sale_id: string;
  number: number;
  receipt_number: string | null;
  issued_at: string;
  device_id: string | null;
  device_name: string | null;
  status: EReceiptStatus;
  uuid: string | null;
  replaced_uuid: string | null;
  reference_uuid: string | null;
  environment: EtaEnvironment | null;
  total: number; // قروش
  tax_total: number | null;
  /** رسالة المنظومة أو التحقق المحلي كما هي. */
  error: string | null;
  /** ترجمتها: ما المشكلة، وماذا أفعل. */
  help_title: string | null;
  help_action: string | null;
  sent_at: string | null;
  late: boolean;
  overdue: boolean;
  /** مرفوض ومرّ عليه أكثر من 96 ساعة: التصحيح يحتاج تأكيداً. */
  amendment_late: boolean;
  resend: ResendMode | null;
}

export interface ReceiptList {
  items: ReceiptItem[];
  total: number;
  page: number;
  page_size: number;
  devices: { id: string; name: string }[];
}

export interface ReceiptFiltersQuery {
  status?: EReceiptStatus | "attention";
  kind?: "sale" | "return";
  device_id?: string;
  date_from?: string;
  date_to?: string;
  q?: string;
  page: number;
  page_size: number;
}

export interface ResendResult {
  corrected: number;
  regenerated: number;
  queued: number;
  errors: {
    id: string;
    number: number | null;
    message: string;
    code: string;
  }[];
}

export interface QueueInfo {
  enabled: boolean;
  waiting: number;
  rejected: number;
  late: number;
  overdue: number;
}

export interface EReceiptReport extends Record<EReceiptStatus, number> {
  issued: number;
  sent: number;
  tax_sales: number; // قروش
  tax_returns: number;
  tax_reported: number;
  accepted_total: number;
}

export interface EnvironmentPreview {
  current: EtaEnvironment;
  /** إيصالات البيئة الحالية التي لم يكتمل إرسالها (ستصبح «غير مطلوب»). */
  unsent: number;
}
