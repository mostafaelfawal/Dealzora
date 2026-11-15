import { StyleSheet, View } from "react-native";

import type { TransferStatus } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { useTheme } from "@/theme/ThemeProvider";

import { STATUS_LABEL, STATUS_TONE } from "../lib/transferText";

/** الحالة نصاً دائماً (اللون لا يحمل المعنى وحده). */
export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const { colors } = useTheme();
  const tone = STATUS_TONE[status];
  const fg = {
    default: colors.foreground,
    warning: colors.warning,
    success: colors.success,
    destructive: colors.destructive,
    muted: colors.mutedForeground,
  }[tone];
  return (
    <View style={[styles.badge, { borderColor: fg }]}>
      <AppText size="xs" weight="semibold" style={{ color: fg }}>
        {STATUS_LABEL[status]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
});
