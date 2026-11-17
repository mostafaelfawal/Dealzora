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

import { useNotificationRouting } from "@/features/alerts/hooks/useNotificationRouting";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { bootstrapSession } from "@/features/auth/lib/session";
import { LockGate } from "@/features/lock/components/LockGate";
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE,
  persister,
  queryClient,
  shouldPersistQuery,
  wireQueryManagers,
} from "@/lib/queryClient";
import { fontAssets, fontFamily } from "@/theme/fonts";
import { ensureRTL } from "@/theme/rtl";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { useThemePrefLoaded } from "@/theme/themePref";

void SplashScreen.preventAutoHideAsync();
ensureRTL();
wireQueryManagers();

/** شريط الحالة يتبع مظهر التطبيق (لا مظهر الهاتف) لو اختار المستخدم فاتحاً أو داكناً. */
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const { status } = useAuth();
  const themeLoaded = useThemePrefLoaded();

  useEffect(() => {
    void bootstrapSession();
  }, []);

  // لو فشل تحميل الخط نكمل بخط النظام بدل شاشة بيضاء.
  const ready =
    (fontsLoaded || !!fontError) && status !== "loading" && themeLoaded;
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
            persistOptions={{
              persister,
              maxAge: CACHE_MAX_AGE,
              buster: CACHE_BUSTER,
              dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
            }}
          >
            <View style={styles.rtl}>
              <LockGate
                active={status === "signedIn" || status === "planBlocked"}
              >
                <RootStack />
              </LockGate>
            </View>
            <ThemedStatusBar />
          </PersistQueryClientProvider>
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { status } = useAuth();
  const { colors } = useTheme();
  useNotificationRouting(status === "signedIn");
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
        <Stack.Screen name="transfer/[id]" options={{ title: "التحويل" }} />
        <Stack.Screen
          name="alerts-settings"
          options={{ title: "إعدادات التنبيهات" }}
        />
        <Stack.Screen
          name="receipts"
          options={{ title: "الإيصالات الإلكترونية" }}
        />
        <Stack.Screen name="security/staff" options={{ title: "الموظفون" }} />
        <Stack.Screen
          name="security/devices"
          options={{ title: "أجهزة الفروع" }}
        />
        <Stack.Screen
          name="security/sessions"
          options={{ title: "جلسات الهاتف" }}
        />
        <Stack.Screen name="stock" options={{ title: "المخزون والنواقص" }} />
        <Stack.Screen name="shifts" options={{ title: "الورديات" }} />
        <Stack.Screen
          name="sensitive"
          options={{ title: "العمليات الحساسة" }}
        />
        <Stack.Screen name="top-sellers" options={{ title: "الأكثر مبيعاً" }} />
        <Stack.Screen
          name="report-settings"
          options={{ title: "حدود العمليات الحساسة" }}
        />
        <Stack.Screen name="prices" options={{ title: "أسعار الأصناف" }} />
        <Stack.Screen
          name="recap/[period]/[date]"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            animation: "fade",
            contentStyle: { backgroundColor: "#0a0a0a" },
          }}
        />
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
