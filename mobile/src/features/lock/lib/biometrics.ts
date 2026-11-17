/**
 * البصمة / الوجه عبر expo-local-authentication. لو فشلت البصمة يُسمح برمز قفل الهاتف نفسه
 * (disableDeviceFallback=false) حتى لا يُحبس صاحب الهاتف خارج التطبيق.
 *
 * ملاحظة: Face ID لا يعمل داخل Expo Go على iPhone (يحتاج development build)، والبصمة على أندرويد تعمل.
 */
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

/** نسخة الويب (PWA): لا بصمة في المتصفح، والقفل بالرمز السري فقط. */
const WEB = Platform.OS === "web";

export interface BiometricInfo {
  /** يوجد عتاد ومسجّل عليه بصمة/وجه. */
  available: boolean;
  label: string;
}

export async function getBiometricInfo(): Promise<BiometricInfo> {
  if (WEB) return { available: false, label: "البصمة" };
  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const face = types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    );
    const finger = types.includes(
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    );
    const label =
      face && !finger
        ? "بصمة الوجه"
        : finger && !face
          ? "البصمة"
          : "البصمة أو الوجه";
    return { available: hardware && enrolled, label };
  } catch {
    return { available: false, label: "البصمة" };
  }
}

export async function authenticate(promptMessage: string): Promise<boolean> {
  if (WEB) return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "إلغاء",
      fallbackLabel: "استخدم رمز الهاتف",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
