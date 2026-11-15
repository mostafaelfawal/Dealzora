/**
 * الجذر: الخط، RTL، الوضع الداكن، TanStack Query (مع حفظ آخر بيانات)، قفل البصمة، والتوجيه حسب حالة الدخول:
 *   signedIn    ← التبويبات + حسابي
 *   planBlocked ← شاشة الترقية فقط
 *   signedOut   ← الدخول
 */
import { useFonts } from "expo-font";
import { LocaleProvider, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { bootstrapSession } from "@/features/auth/lib/session";
import { LockGate } from "@/features/lock/components/LockGate";
import { CACHE_BUSTER, CACHE_MAX_AGE, persister, queryClient, wireQueryManagers } from "@/lib/queryClient";
import { fontAssets, fontFamily } from "@/theme/fonts";
import { ensureRTL } from "@/theme/rtl";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

void SplashScreen.preventAutoHideAsync();
ensureRTL();
wireQueryManagers();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const { status } = useAuth();

  useEffect(() => {
    void bootstrapSession();
  }, []);

  // لو فشل تحميل الخط نكمل بخط النظام بدل شاشة بيضاء.
  const ready = (fontsLoaded || !!fontError) && status !== "loading";
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider direction="rtl">
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: CACHE_BUSTER }}
          >
            <View style={styles.rtl}>
              <LockGate active={status === "signedIn" || status === "planBlocked"}>
                <RootStack />
              </LockGate>
            </View>
            <StatusBar style="auto" />
          </PersistQueryClientProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { status } = useAuth();
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTitleStyle: { fontFamily: fontFamily.semibold },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={status === "signedIn"}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: "حسابي" }} />
        <Stack.Screen name="branch/[id]" options={{ title: "الفرع" }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "planBlocked"}>
        <Stack.Screen name="upgrade" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  // يقلب التخطيط فوراً حتى في Expo Go (قبل أن يسري forceRTL بعد إعادة الفتح).
  rtl: { flex: 1, direction: "rtl" },
});
