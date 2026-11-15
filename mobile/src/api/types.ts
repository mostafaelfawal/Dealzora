/**
 * أنواع ردود خادم المزامنة لمسارات الهاتف (/mobile/v1).
 * مطابقة لـ sync-server/app/schemas.py (قسم «تطبيق الهاتف»): أي تغيير هناك يتغير هنا.
 */

export type MobileRole = "owner" | "manager";

export interface MobileUser {
  account_id: string;
  username: string;
  role: MobileRole;
  shop_id: string;
  shop_name: string;
  /** الفروع المسموح للمستخدم برؤيتها (المالك = كل فروع المحل). */
  branch_ids: string[];
}

export interface MobileTokens {
  access_token: string;
  token_type: string;
  /** ISO 8601 */
  expires_at: string;
  refresh_token: string;
  refresh_expires_at: string;
  session_id: string;
  user: MobileUser;
}

/** ما يُحفظ في SecureStore فقط (بدون بيانات المستخدم). */
export interface StoredTokens {
  access_token: string;
  expires_at: string;
  refresh_token: string;
  session_id: string;
}

export interface MobileSession {
  id: string;
  device_name: string;
  platform: string;
  created_at: string;
  last_used_at: string | null;
  is_current: boolean;
}

/** online متصل · late متأخر · offline منقطع · never لم يتصل أبداً · disabled موقوف */
export type BranchStatus = "online" | "late" | "offline" | "never" | "disabled";

export interface MobileBranch {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  online: boolean;
  /** آخر اتصال للفرع بالخادم. */
  last_seen_at: string | null;
  status: BranchStatus;
  seconds_since_seen: number | null;
  /** أحداث باقي الفروع التي لم يطبّقها الفرع بعد (تأخر المزامنة). */
  pending_events: number;
  /** آخر رفع لملخص المبيعات من الفرع. */
  stats_updated_at: string | null;
}

/** أرقام فترة. المال بالقروش (integer)، والتنسيق في العرض فقط. */
export interface Totals {
  count: number;
  revenue: number;
  returns: number;
  net: number;
  cost: number;
  profit: number;
  discounts: number;
  cash: number;
  credit: number;
  wallet: number;
  expenses: number;
  eta_waiting: number;
  eta_accepted: number;
  eta_rejected: number;
  /** profit - expenses */
  net_profit: number;
}

export interface BranchTotals extends Totals {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  /** «آخر تحديث من الفرع» لأرقام هذه الفترة (null = لم يرسل شيئاً فيها). */
  last_update: string | null;
  reported_days: number;
  /** أيام الفترة من يوم إنشاء الفرع: reported_days أقل منها = بيانات ناقصة، لا صفر مبيعات. */
  expected_days: number;
}

export interface SummaryDay {
  /** YYYY-MM-DD */
  day: string;
  count: number;
  net: number;
  profit: number;
  expenses: number;
  branches: Record<string, number>;
  reported_branches: number;
}

export interface SummaryCompare {
  date_from: string;
  date_to: string;
  totals: Totals;
  branches_reported: number;
}

export interface Summary {
  date_from: string;
  date_to: string;
  totals: Totals;
  /** الأعلى صافياً أولاً (نفس ترتيب تقرير الفروع في البرنامج). */
  branches: BranchTotals[];
  days: SummaryDay[];
  compare: { previous: SummaryCompare; week_ago: SummaryCompare | null };
  branches_total: number;
  generated_at: string;
}

export interface LoginInput {
  code: string;
  username: string;
  password: string;
  device_id: string;
  device_name: string;
  platform: "android" | "ios" | "other";
}

/** شكل الخطأ الموحّد من الخادم: {"error": {"code", "message", "details"}} */
export interface ServerErrorBody {
  error?: { code?: unknown; message?: unknown; details?: unknown };
}

// ================= التحويلات (/mobile/v1/transfers) =================
export type TransferStatus = "requested" | "rejected" | "withdrawn" | "sent" | "received" | "partial" | "cancelled";

export interface TransferLine {
  id: string;
  product_id: string;
  barcode: string | null;
  name: string;
  unit: string;
  /** الكميات × 1000 (نفس قاعدة البرنامج). */
  qty_requested: number | null;
  qty_sent: number;
  qty_received: number | null;
  /** قروش */
  unit_cost: number;
  batch_no: string | null;
  expiry_date: string | null;
}

export type CommandStatus = "pending" | "executing" | "done" | "failed" | "superseded" | "expired" | "cancelled";

/** موافقة طُلبت من الهاتف وينفّذها جهاز الفرع. */
export interface TransferApproval {
  id: string;
  action: string;
  status: CommandStatus;
  requested_by: string;
  device_name: string;
  created_at: string;
  claimed_at: string | null;
  resolved_at: string | null;
  error_message: string | null;
}

export interface Transfer {
  id: string;
  number: number;
  from_branch_id: string;
  from_branch_name: string;
  to_branch_id: string;
  to_branch_name: string;
  status: TransferStatus;
  note: string | null;
  receive_note: string | null;
  sent_by: string | null;
  received_by: string | null;
  requested_by: string | null;
  requested_at: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  sent_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  /** للتعارض: يُرسل مع الموافقة/الرفض، وتغيّره من جهاز آخر = 409 transfer_changed. */
  version: number;
  total_cost: number;
  shortage_cost: number;
  lines: TransferLine[];
  approval: TransferApproval | null;
  can_approve: boolean;
  can_reject: boolean;
}

export interface TransferList {
  items: Transfer[];
  total: number;
}

// ================= التنبيهات =================
export type NotificationKind =
  | "branch_offline"
  | "eta_rejected"
  | "transfer_request"
  | "low_sales"
  | "sensitive_op"
  | "cash_diff"
  | "test"; // إشعار تجريبي (python -m app.cli test-notify)

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** شاشة التطبيق عند الضغط (مسار expo-router). */
  route: string;
  status: "pending" | "sent" | "dropped";
  created_at: string;
  read_at: string | null;
}

export interface NotificationList {
  items: AppNotification[];
  unread: number;
}

export interface NotificationPrefs {
  branch_offline: { enabled: boolean; minutes: number };
  eta_rejected: { enabled: boolean };
  transfer_request: { enabled: boolean };
  low_sales: { enabled: boolean };
  sensitive_op: { enabled: boolean };
  cash_diff: { enabled: boolean };
  quiet: { enabled: boolean; start: string; end: string };
  utc_offset_minutes: number;
  push_on_this_device: boolean;
}

// ================= أمان المحل (المالك فقط) =================
export interface StaffMember {
  id: string;
  username: string;
  role: "manager" | "cashier" | string;
  is_active: boolean;
  branches: { id: string; name: string }[];
  updated_at: string | null;
}

export interface BranchDevice {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  is_admin: boolean;
  /** false = لا جهاز مربوط (يحتاج كود ربط). */
  paired: boolean;
  status: BranchStatus;
  last_seen_at: string | null;
  seconds_since_seen: number | null;
}

export interface PairingCode {
  branch_id: string;
  branch_name: string;
  code: string;
  expires_at: string;
}

export interface ShopSession {
  id: string;
  username: string;
  device_name: string;
  platform: string;
  created_at: string;
  last_used_at: string | null;
  is_current: boolean;
}

// ================= ملخصات الفروع (المرحلة 7) =================
export interface Suggestion {
  branch_id: string;
  branch_name: string;
  /** × 1000 فوق حد الطلب عنده */
  surplus: number;
}

export interface Shortage {
  key: string;
  product_id: string;
  barcode: string | null;
  name: string;
  unit: string;
  qty: number;
  min: number;
  need: number;
  suggestions: Suggestion[];
}

export interface BranchShortages {
  branch_id: string;
  branch_name: string;
  /** null = الفرع لم يرسل بعد (إصدار أقدم أو غير متصل) */
  updated_at: string | null;
  items: Shortage[];
}

export interface Expiring {
  key: string;
  name: string;
  unit: string;
  batch_no: string | null;
  expiry: string;
  qty: number;
}

export interface BranchExpiring {
  branch_id: string;
  branch_name: string;
  updated_at: string | null;
  items: Expiring[];
}

export interface ShiftData {
  cashier: string;
  opened_at: string;
  closed_at: string;
  expected: number;
  counted: number;
  /** موجب = زيادة، سالب = عجز (قروش) */
  difference: number;
}

export type SensitiveType = "discount" | "return" | "full_return";

export interface SensitiveData {
  type: SensitiveType;
  number: number;
  amount: number;
  total: number;
  cashier: string;
}

export interface BranchRecord<T> {
  id: string;
  branch_id: string;
  branch_name: string;
  day: string;
  at: string | null;
  data: T;
  received_at: string;
}

export interface TopSeller {
  key: string;
  name: string;
  unit: string;
  qty: number;
  revenue: number;
  branches: number;
}

export interface ReportConfig {
  discount_min: number;
  return_min: number;
  cash_diff_min: number;
  expiry_days: number;
}

// ================= أسعار الأصناف المشتركة (المالك) =================
export interface CatalogProduct {
  gid: string;
  name: string;
  barcode: string | null;
  unit: string;
  /** قروش */
  sale_price: number;
  wholesale_price: number | null;
  wholesale_min_qty: number | null;
  is_active: boolean;
  /** للتعارض: يُرسل مع التعديل، وتغيّره من فرع = 409 catalog_changed */
  version: number;
  updated_at: string | null;
  updated_by: string | null;
}
