import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { useOnline } from "@/hooks/useOnline";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { AppText } from "./AppText";

/** شريط ثابت أعلى الشاشات حين لا يوجد إنترنت: البيانات المعروضة هي آخر نسخة محفوظة. */
export function OfflineBanner() {
  const online = useOnline();
  const { colors } = useTheme();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.bar, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <View style={styles.text}>
        <AppText size="sm" weight="semibold" tone="warning">
          لا يوجد اتصال بالإنترنت
        </AppText>
        <AppText size="xs" tone="muted">
          تعرض آخر بيانات محفوظة، وتتحدث تلقائياً عند رجوع الاتصال
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
  },
  text: { flex: 1 },
});
