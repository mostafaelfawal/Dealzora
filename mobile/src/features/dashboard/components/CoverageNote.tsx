/** تنبيه: الإجمالي لا يشمل فروعاً لم ترسل بياناتها بعد (الفرع قد يعمل بلا إنترنت). */
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import type { Summary } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { formatArabicCount } from "@/lib/format";
import { radius, space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { missingBranches } from "../lib/insights";

export function CoverageNote({ summary, singleDay }: { summary: Summary; singleDay: boolean }) {
  const { colors } = useTheme();
  const missing = missingBranches(summary);
  if (missing.length === 0) return null;
  const count = formatArabicCount(missing.length, { one: "فرع", two: "فرعان", few: "فروع", many: "فرعًا" });
  const names = missing.map((b) => b.name).join("، ");
  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
    >
      <Ionicons name="time-outline" size={18} color={colors.warning} />
      <View style={styles.text}>
        <AppText size="sm" weight="semibold">
          {missing.length === 1 ? "فرع" : count} لم {missing.length === 1 ? "يرسل" : "ترسل"} كل بيانات{" "}
          {singleDay ? "اليوم" : "الفترة"} بعد
        </AppText>
        <AppText size="xs" tone="muted">
          {names}. الإجمالي يشمل ما وصل فقط، ويكتمل حين يتصل الفرع بالإنترنت.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  text: { flex: 1, gap: 2 },
});
