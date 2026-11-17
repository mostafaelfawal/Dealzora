import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  authenticate,
  getBiometricInfo,
  type BiometricInfo,
} from "../lib/biometrics";
import {
  getLockEnabled,
  loadLockEnabled,
  setLockEnabled,
  subscribeLock,
} from "../lib/lockStore";
import { getPinSet, loadPinSet, subscribePin } from "../lib/pin";

/**
 * حالة القفل: بالبصمة (لو الهاتف يدعمها) و/أو برمز سري (أي هاتف، ونسخة الويب).
 * تغيير البصمة يتطلب البصمة، وتغيير الرمز يتطلب الرمز الحالي (شاشة /pin).
 */
export function useLockSettings() {
  const enabled = useSyncExternalStore(
    subscribeLock,
    getLockEnabled,
    getLockEnabled,
  );
  const pinSet = useSyncExternalStore(subscribePin, getPinSet, getPinSet);
  const [info, setInfo] = useState<BiometricInfo | null>(null);

  useEffect(() => {
    void loadLockEnabled();
    void loadPinSet();
    void getBiometricInfo().then(setInfo);
  }, []);

  const toggle = useCallback(async (next: boolean): Promise<boolean> => {
    const ok = await authenticate(
      next ? "تفعيل القفل بالبصمة" : "إيقاف القفل بالبصمة",
    );
    if (ok) await setLockEnabled(next);
    return ok;
  }, []);

  const biometric = !!enabled && !!info?.available;
  return {
    /** البصمة مفعّلة فعلياً = الإعداد + الهاتف يدعمها. */
    enabled: biometric,
    /** يوجد رمز سري. */
    pinSet: !!pinSet,
    /** القفل يعمل بأي طريقة. */
    guarded: biometric || !!pinSet,
    available: info?.available ?? false,
    label: info?.label ?? "البصمة",
    loading: enabled === null || pinSet === null || info === null,
    toggle,
  };
}
