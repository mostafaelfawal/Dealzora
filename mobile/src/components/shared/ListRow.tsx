import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { AppText } from "./AppText";

interface Props {
  title: string;
  subtitle?: ReactNode;
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** عنصر في نهاية السطر (مفتاح تشغيل، شارة…). بدونه ومع onPress يظهر سهم. */
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}

/** سطر إعدادات/تنقّل: أيقونة داخل مربع، عنوان ووصف، ونهاية السطر. الضغط يلوّن خلفية السطر كاملاً. */
export function ListRow({
  title,
  subtitle,
  icon,
  trailing,
  onPress,
  destructive,
}: Props) {
  const { colors } = useTheme();
  const content = (
    <View style={styles.row}>
      {icon && (
        <View
          style={[
            styles.iconTile,
            {
              backgroundColor: destructive
                ? colors.destructiveSoft
                : colors.muted,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={19}
            color={destructive ? colors.destructive : colors.foreground}
          />
        </View>
      )}
      <View style={styles.text}>
        <AppText weight="medium" tone={destructive ? "destructive" : "default"}>
          {title}
        </AppText>
        {typeof subtitle === "string" ? (
          <AppText size="xs" tone="muted">
            {subtitle}
          </AppText>
        ) : (
          subtitle
        )}
      </View>
      {/* chevron-back يشير لليسار = «للأمام» في RTL */}
      {trailing ??
        (onPress ? (
          <Ionicons
            name="chevron-back"
            size={18}
            color={colors.mutedForeground}
          />
        ) : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        pressed && { backgroundColor: colors.muted },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.xs,
  },
  // الخلفية عند الضغط تمتد لحواف البطاقة تقريباً
  pressable: { marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  iconTile: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
});
