/**
 * هوية Dealzora.
 * لو أسماء ملفات اللوجو متعاكسة (الفاتح/الغامق) بدّلها هنا فقط.
 * `light` = اللوجو اللي بيظهر في الوضع الفاتح، `dark` = في الوضع الداكن.
 */
export const BRAND = {
  name: "Dealzora",
  logo: {
    icon: {
      light: "/logo/light_logo.svg",
      dark: "/logo/dark_logo.svg",
      width: 32,
      height: 32,
    },
    full: {
      light: "/logo/full_logo_light.png",
      dark: "/logo/full_logo_dark.png",
      width: 132,
      height: 32,
    },
  },
} as const;
