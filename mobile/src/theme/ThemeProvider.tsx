/** الوضع الفاتح/الداكن: اختيار المستخدم في «المزيد» (تلقائي = إعداد الهاتف)، وألوان التنقّل من نفس الهوية. */
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, type Theme } from "expo-router";
import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";

import { chartDark, chartLight, dark, light, type Palette } from "./colors";
import { fontFamily } from "./fonts";
import { useThemePref } from "./themePref";

interface ThemeValue {
  colors: Palette;
  chart: typeof chartLight;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ colors: light, chart: chartLight, isDark: false });

export function ThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  const pref = useThemePref();
  const isDark = pref === "system" ? scheme === "dark" : pref === "dark";
  const value = useMemo<ThemeValue>(() => ({ colors: isDark ? dark : light, chart: isDark ? chartDark : chartLight, isDark }), [isDark]);

  const navTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    const c = value.colors;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: c.foreground,
        background: c.background,
        card: c.card,
        text: c.foreground,
        border: c.border,
        notification: c.destructive,
      },
      fonts: {
        regular: { fontFamily: fontFamily.regular, fontWeight: "400" },
        medium: { fontFamily: fontFamily.medium, fontWeight: "500" },
        bold: { fontFamily: fontFamily.semibold, fontWeight: "600" },
        heavy: { fontFamily: fontFamily.bold, fontWeight: "700" },
      },
    };
  }, [isDark, value.colors]);

  return (
    <ThemeContext.Provider value={value}>
      <NavThemeProvider value={navTheme}>{children}</NavThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
