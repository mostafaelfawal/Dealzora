import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { AppText } from "./AppText";

interface Props {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, { backgroundColor: colors.muted }]}>
        <Ionicons name={icon} size={28} color={colors.mutedForeground} />
      </View>
      <AppText weight="semibold" size="lg" center>
        {title}
      </AppText>
      {description && (
        <AppText tone="muted" size="sm" center>
          {description}
        </AppText>
      )}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: space.sm, paddingVertical: space.xl * 2, paddingHorizontal: space.lg },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: space.sm },
});
