/**
 * قائمة الفروع المسموحة: الحالة (متصل / متأخر / منقطع منذ كذا)، تأخر المزامنة، وآخر ملخص مبيعات
 * وصل من الفرع. اللمس يفتح تفاصيل الفرع.
 */
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { MobileBranch } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { statusText, syncLagText } from "@/features/dashboard/lib/insights";
import { useNow } from "@/hooks/useNow";
import { formatTimeAgo } from "@/lib/format";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { BranchStatusBadge } from "./BranchStatusBadge";

/** الأسوأ أولاً: المنقطع والمتأخر يحتاجان انتباهاً. */
const ORDER = { offline: 0, late: 1, never: 2, online: 3, disabled: 4 } as const;

export function BranchList({ branches }: { branches: MobileBranch[] }) {
  const now = useNow();
  const { colors } = useTheme();
  const sorted = [...branches].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  return (
    <View style={styles.list}>
      {sorted.map((b) => {
        const lag = syncLagText(b.pending_events);
        return (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityHint="تفاصيل الفرع"
            onPress={() => router.push({ pathname: "/branch/[id]", params: { id: b.id } })}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Card style={styles.card}>
              <View style={styles.head}>
                <AppText weight="semibold" style={styles.name} numberOfLines={1}>
                  {b.name}
                </AppText>
                <BranchStatusBadge status={b.status} />
                <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
              </View>
              <AppText size="xs" tone="muted">
                {statusText(b.status, b.seconds_since_seen)}
              </AppText>
              <AppText size="xs" tone="muted">
                {b.stats_updated_at
                  ? `آخر ملخص مبيعات من الفرع: ${formatTimeAgo(b.stats_updated_at, now)}`
                  : "لم يرسل الفرع ملخص مبيعات بعد"}
              </AppText>
              {lag && b.status !== "online" && (
                <AppText size="xs" tone="warning">
                  {lag}
                </AppText>
              )}
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  card: { gap: 2, paddingVertical: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1 },
});
