/**
 * شعار Dealzora (نفس ملفات frontend/public/logo). الصور بخلفية مصمتة، فتُعرض داخل مستطيل
 * بحواف حادة بنفس لون خلفيتها (style لتغيير المحاذاة). ملاحظة: أسماء الملفين في frontend معكوسة (كما يذكر config/brand.ts):
 * full_logo_light.png = أبيض على داكن (للوضع الداكن).
 */
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { radius } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

const LOGOS = {
  light: { source: require("../../../assets/brand/full_logo_dark.png"), ratio: 1536 / 584, bg: "#ffffff" },
  dark: { source: require("../../../assets/brand/full_logo_light.png"), ratio: 767 / 304, bg: "#0f1012" },
} as const;

export function BrandLogo({ width = 200, style }: { width?: number; style?: StyleProp<ViewStyle> }) {
  const { isDark } = useTheme();
  const logo = isDark ? LOGOS.dark : LOGOS.light;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Dealzora"
      style={[styles.tile, { width, height: width / logo.ratio, backgroundColor: logo.bg }, style]}
    >
      <Image source={logo.source} style={styles.img} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.lg, overflow: "hidden", alignSelf: "center" },
  img: { width: "100%", height: "100%" },
});
