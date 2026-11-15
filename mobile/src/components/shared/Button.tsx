import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import { radius, space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { AppText } from "./AppText";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

interface Props extends Omit<PressableProps, "children"> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ComponentProps<typeof Ionicons>["name"];
}

/** زر بارتفاع 48 (هدف لمس مريح على الشاشات الصغيرة). */
export function Button({ title, variant = "primary", loading, icon, disabled, style, ...rest }: Props) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary },
    secondary: { bg: colors.secondary, fg: colors.foreground, border: colors.border },
    destructive: { bg: colors.destructiveSoft, fg: colors.destructive, border: colors.destructive },
    ghost: { bg: "transparent", fg: colors.foreground, border: "transparent" },
  }[variant];
  const off = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      style={(state) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: off ? 0.55 : state.pressed ? 0.8 : 1 },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={palette.fg} />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={18} color={palette.fg} />}
            <AppText weight="semibold" style={{ color: palette.fg }}>
              {title}
            </AppText>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
});
