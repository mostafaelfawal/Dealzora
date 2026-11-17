/**
 * حالة إشعارات هذا الهاتف وإذن المستخدم: شرح قبل نافذة النظام، ثم «تفعيل الإشعارات» (يطلب الإذن)،
 * أو «فتح إعدادات الهاتف» لو رُفض نهائياً، و«إشعار تجريبي» بعد التفعيل.
 * compact: في شاشة التنبيهات تظهر فقط حين تحتاج تصرفاً.
 */
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { PUSH_STATE_TEXT, sendTestNotification } from "../lib/push";
import { enablePush, openPhoneSettings, usePushState } from "../lib/pushStore";

export function PushPermissionCard({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const state = usePushState();
  const [busy, setBusy] = useState(false);

  const on = state === "enabled" || state === "local";
  if (compact && (on || state === null)) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const s = await enablePush();
      if (s === "enabled" || s === "local") await sendTestNotification();
      else if (s === "error")
        Alert.alert("تعذّر تفعيل الإشعارات", "حاول مرة أخرى بعد قليل.");
      else
        // لم يُمنح الإذن (رفض الآن، أو النظام لم يُظهر النافذة لأن الرفض سابق): التفعيل من الإعدادات
        Alert.alert(
          "الإشعارات غير مسموحة",
          "اسمح بالإشعارات للتطبيق من إعدادات الهاتف ← الإشعارات.",
          [
            { text: "لاحقاً", style: "cancel" },
            { text: "فتح الإعدادات", onPress: () => void openPhoneSettings() },
          ],
        );
    } catch {
      Alert.alert("تعذّر تفعيل الإشعارات", "حاول مرة أخرى بعد قليل.");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    try {
      await sendTestNotification();
    } catch {
      Alert.alert(
        "تعذّر إرسال الإشعار التجريبي",
        "تأكد أن الإشعارات مفعّلة للتطبيق في إعدادات الهاتف.",
      );
    }
  };

  return (
    <Card style={!on && { borderColor: colors.warning }}>
      <View style={styles.head}>
        <Ionicons
          name={on ? "notifications" : "notifications-off-outline"}
          size={22}
          color={on ? colors.success : colors.warning}
        />
        <AppText weight="semibold" style={styles.flex}>
          {on ? "الإشعارات مفعّلة" : "فعّل الإشعارات"}
        </AppText>
      </View>
      <AppText size="sm" tone="muted">
        {state === null
          ? "جارٍ التحقق من الإشعارات…"
          : on
            ? PUSH_STATE_TEXT[state]
            : "ليصلك على الهاتف: طلب تحويل ينتظر موافقتك، فرع انقطع، إيصالات مرفوضة، وعمليات حساسة. الإشعار لا يحوي مبالغ."}
      </AppText>
      {(state === "needs_permission" || state === "error") && (
        <Button
          title="تفعيل الإشعارات"
          icon="notifications-outline"
          onPress={enable}
          loading={busy}
        />
      )}
      {state === "denied" && (
        <>
          <AppText size="xs" tone="warning">
            {PUSH_STATE_TEXT.denied}
          </AppText>
          <Button
            title="فتح إعدادات الهاتف"
            icon="settings-outline"
            variant="secondary"
            onPress={() => void openPhoneSettings()}
          />
        </>
      )}
      {on && !compact && (
        <Button
          title="إرسال إشعار تجريبي"
          icon="paper-plane-outline"
          variant="secondary"
          onPress={test}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
});
