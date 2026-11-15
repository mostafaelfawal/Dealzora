/** حالة الفرع: أيقونة + نص (لا لون وحده). الحالة لون من ألوان الحالة المحجوزة فقط. */
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import type { BranchStatus } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { STATUS_LABEL } from "@/features/dashboard/lib/insights";
import { useTheme } from "@/theme/ThemeProvider";

const ICON: Record<BranchStatus, ComponentProps<typeof Ionicons>["name"]> = {
  online: "checkmark-circle",
  late: "time",
  offline: "cloud-offline",
  never: "help-circle",
  disabled: "pause-circle",
};

export function BranchStatusBadge({ status }: { status: BranchStatus }) {
  const { colors } = useTheme();
  const color = {
    online: colors.success,
    late: colors.warning,
    offline: colors.destructive,
    never: colors.mutedForeground,
    disabled: colors.mutedForeground,
  }[status];
  return (
    <View style={styles.row} accessibilityLabel={STATUS_LABEL[status]}>
      <Ionicons name={ICON[status]} size={14} color={color} />
      <AppText size="xs" weight="semibold" style={{ color }}>
        {STATUS_LABEL[status]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
});
