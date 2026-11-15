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
