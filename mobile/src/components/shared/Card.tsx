import { StyleSheet, View, type ViewProps } from "react-native";

import { radius, space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
});
