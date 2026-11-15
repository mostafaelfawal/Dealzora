import { View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

export function StatusDot({ online }: { online: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel={online ? "متصل" : "غير متصل"}
      style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: online ? colors.success : colors.mutedForeground }}
    />
  );
}
