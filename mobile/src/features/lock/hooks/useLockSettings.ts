import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { authenticate, getBiometricInfo, type BiometricInfo } from "../lib/biometrics";
import { getLockEnabled, loadLockEnabled, setLockEnabled, subscribeLock } from "../lib/lockStore";

/** حالة القفل وتغييرها (التغيير في الاتجاهين يتطلب البصمة: يثبت أن صاحب الهاتف هو من يغيّر). */
export function useLockSettings() {
  const enabled = useSyncExternalStore(subscribeLock, getLockEnabled, getLockEnabled);
  const [info, setInfo] = useState<BiometricInfo | null>(null);

  useEffect(() => {
    void loadLockEnabled();
    void getBiometricInfo().then(setInfo);
  }, []);

  const toggle = useCallback(async (next: boolean): Promise<boolean> => {
    const ok = await authenticate(next ? "تفعيل القفل بالبصمة" : "إيقاف القفل بالبصمة");
    if (ok) await setLockEnabled(next);
    return ok;
  }, []);

  return {
    /** مفعّل فعلياً = الإعداد + الهاتف يدعمه. */
    enabled: !!enabled && !!info?.available,
    available: info?.available ?? false,
    label: info?.label ?? "البصمة",
    loading: enabled === null || info === null,
    toggle,
  };
}
