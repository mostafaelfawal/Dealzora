/** الوضع الفاتح/الداكن يتبع إعداد الهاتف، وألوان التنقّل (العناوين والتبويبات) من نفس الهوية. */
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, type Theme } from "expo-router";
import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";

import { dark, light, type Palette } from "./colors";
import { fontFamily } from "./fonts";

interface ThemeValue {
  colors: Palette;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ colors: light, isDark: false });

export function ThemeProvider({ children }: PropsWithChildren) {
  const isDark = useColorScheme() === "dark";
  const value = useMemo<ThemeValue>(() => ({ colors: isDark ? dark : light, isDark }), [isDark]);

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
