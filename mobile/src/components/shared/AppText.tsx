import { Text, type TextProps } from "react-native";

import { fontFamily, fontSize, type FontWeight } from "@/theme/fonts";
import { rtlText } from "@/theme/rtl";
import { useTheme } from "@/theme/ThemeProvider";

type Tone = "default" | "muted" | "destructive" | "success" | "warning" | "inverse";

export interface AppTextProps extends TextProps {
  weight?: FontWeight;
  size?: keyof typeof fontSize;
  tone?: Tone;
  center?: boolean;
}

/** كل نصوص التطبيق: الخط العربي، محاذاة RTL، ولون الوضع الحالي. */
export function AppText({ weight = "regular", size = "md", tone = "default", center, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const color = {
    default: colors.foreground,
    muted: colors.mutedForeground,
    destructive: colors.destructive,
    success: colors.success,
    warning: colors.warning,
    inverse: colors.primaryForeground,
  }[tone];
  return (
    <Text
      {...rest}
      style={[
        rtlText,
        { fontFamily: fontFamily[weight], fontSize: fontSize[size], lineHeight: Math.round(fontSize[size] * 1.6), color },
        center && { textAlign: "center" },
        style,
      ]}
    />
  );
}
