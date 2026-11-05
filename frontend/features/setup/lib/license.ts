import { invoke, isTauri } from "@tauri-apps/api/core";

import type { LicenseStatus } from "../types/setup";

const LICENSE_ERROR_MESSAGES: Record<string, string> = {
  not_tauri: "افتح البرنامج من نسخة سطح المكتب لإكمال الإعداد.",
  invalid_shop_name: "اسم المحل غير صالح.",
  trial_not_available: "التجربة المجانية استُخدمت من قبل على هذا الجهاز.",
  license_not_started: "لم تبدأ التجربة المجانية بعد.",
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

export const resetLicenseDev = () => call<void>("reset_license_dev");
export const getLicenseStatus = () => call<LicenseStatus>("get_license_status");
export const startTrial = (shopName: string) =>
  call<LicenseStatus>("start_trial", { shopName });
