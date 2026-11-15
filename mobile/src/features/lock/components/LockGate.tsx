/**
 * قفل التطبيق بالبصمة/الوجه: عند الفتح، وبعد بقاء التطبيق في الخلفية IDLE_LOCK_MS.
 * - غطاء خصوصية حين يكون التطبيق غير نشط (لا تظهر الأرقام في قائمة التطبيقات المفتوحة).
 * - المحتوى يبقى محمّلاً تحت الغطاء (لا تضيع حالة الشاشات).
 * - مخرج دائم: «تسجيل الخروج» لو تعذّرت البصمة.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Alert, AppState, StyleSheet, View, type AppStateStatus } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { signOut } from "@/features/auth/lib/session";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { useLockSettings } from "../hooks/useLockSettings";
import { authenticate } from "../lib/biometrics";
import { IDLE_LOCK_MS } from "../lib/lockStore";

interface Props extends PropsWithChildren {
  /** القفل يعمل فقط مع جلسة مفتوحة. */
  active: boolean;
}

export function LockGate({ active, children }: Props) {
  const { colors } = useTheme();
  const { enabled, loading, label } = useLockSettings();
  // الجذر يرسم القفل بعد معرفة حالة الدخول: جلسة محفوظة عند الفتح = مقفل، ودخول جديد = مفتوح.
  const [lockedRaw, setLocked] = useState(active);
  const [appState, setAppState] = useState<AppStateStatus>((AppState.currentState as AppStateStatus | null) ?? "active");
  const backgroundAt = useRef<number | null>(null);
  const authenticating = useRef(false);

  const guard = active && enabled;

  // الخروج (أو انتهاء الجلسة من الخادم) يلغي أي قفل معلّق، فلا يُطلب القفل فور الدخول التالي.
  // (ضبط الحالة أثناء الرسم عند تغيّر قيمة، بدل effect.)
  const [prevGuard, setPrevGuard] = useState<boolean | null>(null);
  if (!loading && guard !== prevGuard) {
    setPrevGuard(guard);
    if (!guard) setLocked(false);
  }
  const locked = guard && lockedRaw;

  const unlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    try {
      if (await authenticate("افتح Dealzora")) setLocked(false);
    } finally {
      authenticating.current = false;
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      setAppState(next);
      if (authenticating.current) return; // نافذة البصمة نفسها تغيّر حالة التطبيق
      if (next === "background") backgroundAt.current = Date.now();
      if (next === "active" && backgroundAt.current !== null) {
        if (guard && Date.now() - backgroundAt.current >= IDLE_LOCK_MS) setLocked(true);
        backgroundAt.current = null;
      }
    });
    return () => sub.remove();
  }, [guard]);

  // طلب البصمة تلقائياً بمجرد القفل والتطبيق ظاهر.
  useEffect(() => {
    if (guard && locked && appState === "active") void unlock();
  }, [guard, locked, appState, unlock]);

  const confirmSignOut = () =>
    Alert.alert("تسجيل الخروج", "ستحتاج كود ربط جديد وكلمة المرور للدخول مرة أخرى.", [
      { text: "إلغاء", style: "cancel" },
      { text: "تسجيل الخروج", style: "destructive", onPress: () => void signOut() },
    ]);

  const showCover = active && (loading || (guard && (locked || appState !== "active")));

  return (
    <View style={styles.root}>
      {children}
      {showCover && (
        <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: colors.background }]}>
          <View style={[styles.badge, { backgroundColor: colors.muted }]}>
            <Ionicons name="lock-closed-outline" size={34} color={colors.foreground} />
          </View>
          <AppText weight="bold" size="xl" center>
            Dealzora مقفل
          </AppText>
          {guard && locked && (
            <>
              <AppText tone="muted" center>
                افتح التطبيق بـ{label} أو رمز قفل الهاتف
              </AppText>
              <View style={styles.actions}>
                <Button title="فتح" icon="finger-print-outline" onPress={unlock} />
                <Button title="تسجيل الخروج" variant="ghost" onPress={confirmSignOut} />
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl, zIndex: 100 },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  actions: { alignSelf: "stretch", gap: space.sm, marginTop: space.md },
});
