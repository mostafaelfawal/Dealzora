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

export interface MobileBranch {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  online: boolean;
  /** آخر اتصال للفرع بالخادم: كل رقم يعرض «آخر تحديث من الفرع» منه. */
  last_seen_at: string | null;
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
