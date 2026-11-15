/**
 * المحل ليس على خطة «سلسلة»: رسالة الترقية فقط (الخادم يرفض كل البيانات بـ plan_upgrade_required).
 * الترقية تتم من البرنامج المكتبي على الجهاز الرئيسي، ثم «تحقّق مرة أخرى» يعيد التطبيق للعمل.
 */
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { errorMessage } from "@/api/errors";
import { AppText } from "@/components/shared/AppText";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { refreshUser, signOut } from "@/features/auth/lib/session";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

/** نفس أسماء backend/app/core/plan.py (PLAN_NAMES). */
const PLAN_LABEL: Record<string, string> = {
  free: "بَسطة",
  basic: "دُكّان",
  pro: "سوق",
  enterprise: "سلسلة",
};

export function UpgradeScreen() {
  const { colors } = useTheme();
  const { currentPlan } = useAuth();
  const [checking, setChecking] = useState(false);

  async function recheck() {
    setChecking(true);
    try {
      const ok = await refreshUser();
      if (!ok) Alert.alert("ما زالت الخطة لا تدعم التطبيق", "بعد الترقية من البرنامج، انتظر دقيقة وحاول مرة أخرى.");
    } catch (e) {
      Alert.alert("تعذّر التحقق", errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  const confirmSignOut = () =>
    Alert.alert("تسجيل الخروج", "سيتم الخروج من هذا الهاتف.", [
      { text: "إلغاء", style: "cancel" },
      { text: "تسجيل الخروج", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <ScrollView contentContainerStyle={styles.content}>
        <BrandLogo width={180} />
        <Card style={styles.card}>
          <View style={[styles.badge, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="lock-closed-outline" size={30} color={colors.warning} />
          </View>
          <AppText weight="bold" size="xl" center>
            التطبيق متاح في خطة «سلسلة» فقط
          </AppText>
          <AppText tone="muted" center>
            تطبيق الهاتف لمتابعة كل فروعك من مكان واحد جزء من خطة «سلسلة». رقِّ خطة المحل من البرنامج على
            الجهاز الرئيسي، ثم ارجع هنا.
          </AppText>
          {currentPlan && (
            <AppText size="sm" tone="muted" center>
              خطة المحل الحالية: «{PLAN_LABEL[currentPlan] ?? currentPlan}»
            </AppText>
          )}
        </Card>
        <Button title="تحقّق مرة أخرى" icon="refresh-outline" onPress={recheck} loading={checking} />
        <Button title="تسجيل الخروج" variant="ghost" onPress={confirmSignOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: space.lg, gap: space.lg },
  card: { alignItems: "center", gap: space.md, paddingVertical: space.xl },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
});
