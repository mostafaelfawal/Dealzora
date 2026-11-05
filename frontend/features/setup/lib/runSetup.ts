import { login } from "@/features/auth/api/auth.api";
import type { AuthSession } from "@/features/auth/types/auth";

import { setupFirstManager } from "../api/setup.api";
import type { SetupPayload, SetupStep } from "../types/setup";
import { getLicenseStatus, LicenseError, startTrial } from "./license";

/** آمن للإعادة: لو بدأت التجربة سابقاً وفشل إنشاء الحساب، لا نبدأ تجربة جديدة. */
export async function runSetup(
  payload: SetupPayload,
  onStep: (step: SetupStep) => void,
): Promise<AuthSession> {
  let status = await getLicenseStatus();

  if (status.state === "not_started") {
    onStep("trial");
    status = await startTrial(payload.shopName);
  }
  if (status.state !== "trial" && status.state !== "licensed") {
    throw new LicenseError(`license_${status.state}`);
  }

  onStep("account");
  await setupFirstManager(payload);

  onStep("login");
  return login({ username: payload.username, password: payload.password });
}