/**
 * عنوان خادم المزامنة: ثابت داخل التطبيق، فلا يكتبه المستخدم ولا يقدر يغيّره (لا خطأ في الكتابة،
 * ولا توجيه الهاتف لخادم آخر). تغييره = تعديل SYNC_URL هنا ثم نسخة جديدة من التطبيق.
 *
 * نسخة التطوير فقط (__DEV__): EXPO_PUBLIC_SYNC_URL يغلبه، للتجربة على خادم محلي.
 * أي عنوان قديم محفوظ على الهاتف من نسخ سابقة (كانت تسمح بالكتابة) يُتجاهل.
 */
import { normalizeServerUrl } from "@/api/url";

export const SYNC_URL = "https://dealzora-sync.duckdns.org";

const DEV_URL = __DEV__
  ? normalizeServerUrl(process.env.EXPO_PUBLIC_SYNC_URL)
  : null;

const SERVER = DEV_URL ?? normalizeServerUrl(SYNC_URL);

export async function getServerUrl(): Promise<string | null> {
  return SERVER;
}
