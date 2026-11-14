import { invoke, isTauri } from "@tauri-apps/api/core";

import type { LicenseStatus } from "../types/setup";

const LICENSE_ERROR_MESSAGES: Record<string, string> = {
  not_tauri: "افتح البرنامج من نسخة سطح المكتب لإكمال الإعداد.",
  invalid_shop_name: "اسم المحل غير صالح.",
  trial_not_available: "خطة «بَسطة» المجانية مفعّلة بالفعل على هذا الجهاز.",
  license_not_started: "لم يُجهَّز البرنامج على هذا الجهاز بعد.",
  invalid_key: "مفتاح الترخيص غير صحيح. انسخه كاملاً كما وصلك.",
  key_wrong_machine: "هذا المفتاح صادر لجهاز آخر. أرسل رقم هذا الجهاز للدعم.",
  key_expired: "هذا المفتاح منتهي الصلاحية.",
  activation_unavailable: "التفعيل غير متاح في هذه النسخة من البرنامج.",
  license_expired: "انتهت صلاحية الترخيص.",
  license_tampered:
    "تم اكتشاف تعديل في بيانات الترخيص أو في تاريخ الجهاز. صحّح التاريخ وأعد المحاولة.",
  license_wrong_machine: "هذا الترخيص يخص جهازاً آخر.",
};

export class LicenseError extends Error {
  constructor(public code: string) {
    super(
      LICENSE_ERROR_MESSAGES[code] ?? "تعذّر التحقق من الترخيص. أعد المحاولة.",
    );
  }
}

async function call<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri()) throw new LicenseError("not_tauri");
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw new LicenseError(String(e));
  }
}

export const getLicenseStatus = () => call<LicenseStatus>("get_license_status");
export const startTrial = (shopName: string) =>
  call<LicenseStatus>("start_trial", { shopName });

/** تفعيل ترخيص مدفوع. Rust يعيد تشغيل الخادم المحلي بالخطة الجديدة بعده. */
export const activateLicense = (key: string) =>
  call<LicenseStatus>("activate_license", { key });
