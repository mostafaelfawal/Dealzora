import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { Transfer } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { formatDateTime } from "@/lib/format";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { approvalText, transferSummary } from "../lib/transferText";
import { TransferStatusBadge } from "./TransferStatusBadge";

/** سطر تحويل: الرقم، الفرعان، الحالة، التاريخ، وحالة موافقة الهاتف إن وجدت. */
export function TransferRow({ t }: { t: Transfer }) {
  const { colors } = useTheme();
  const when = t.received_at ?? t.sent_at ?? t.rejected_at ?? t.requested_at;
  const approval = approvalText(t.approval, t.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="تفاصيل التحويل"
      onPress={() => router.push({ pathname: "/transfer/[id]", params: { id: t.id } })}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Card style={styles.card}>
        <View style={styles.head}>
          <AppText weight="semibold">#{t.number}</AppText>
          <TransferStatusBadge status={t.status} />
          <View style={styles.flex} />
          {t.can_approve && (
            <AppText size="xs" weight="semibold" tone="warning">
              ينتظر ردك
            </AppText>
          )}
          <Ionicons name="chevron-back" size={16} color={colors.mutedForeground} />
        </View>
        <AppText size="sm">{transferSummary(t)}</AppText>
        <AppText size="xs" tone="muted">
          {t.lines.length} صنف{when ? ` · ${formatDateTime(when)}` : ""}
        </AppText>
        {approval && (
          <AppText size="xs" tone={t.approval?.status === "failed" ? "destructive" : "muted"}>
            {approval}
          </AppText>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 2, paddingVertical: space.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
});
