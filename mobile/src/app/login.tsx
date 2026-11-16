import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/shared/AppText";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { FadeIn } from "@/components/shared/Motion";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

export default function LoginRoute() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <OfflineBanner />
      {/* أندرويد edge-to-edge (إجباري منذ SDK 54): النافذة لا تصغر مع لوحة المفاتيح، فنرفع المحتوى بـ padding
          على المنصتين، والـ ScrollView يمرّر الحقل المُركَّز عليه لأعلى الكيبورد. */}
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        >
          <View style={styles.head}>
            <FadeIn offset={-10}>
              <BrandLogo width={190} />
            </FadeIn>
            <FadeIn index={2}>
              <AppText weight="bold" size="xxl" center>
                متابعة فروعك من هاتفك
              </AppText>
              <AppText tone="muted" size="sm" center>
                للمالك ومديري الفروع في خطة «سلسلة»
              </AppText>
            </FadeIn>
          </View>
          <FadeIn index={4} offset={20}>
            <LoginForm />
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: space.lg, gap: space.xl },
  head: { gap: space.md },
});
