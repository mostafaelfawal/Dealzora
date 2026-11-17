import type { PropsWithChildren } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { OfflineBanner } from "./OfflineBanner";

interface Props extends PropsWithChildren {
  /** سحب للتحديث. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

/** حاوية الشاشات تحت العنوان: شريط «بلا إنترنت» + محتوى قابل للتمرير بهوامش 16. */
export function Screen({ children, onRefresh, refreshing = false }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.mutedForeground}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
});
