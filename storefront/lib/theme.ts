import type { PublicTheme } from "./types";

/**
 * ألوان المتجر الجاهزة (نفس frontend/features/onlineStore/lib/themePalette.ts ومفاتيح السيرفر).
 * القيمة من السيرفر تُطابَق هنا مع قائمة ثابتة، فلا يصل للـ CSS أي نص من خارج هذا الملف.
 */
const PALETTE: Record<string, { light: [string, string]; dark: [string, string] }> = {
  neutral: { light: ["oklch(0.205 0 0)", "oklch(0.985 0 0)"], dark: ["oklch(0.922 0 0)", "oklch(0.205 0 0)"] },
  emerald: { light: ["oklch(0.508 0.118 165.6)", "oklch(0.985 0 0)"], dark: ["oklch(0.765 0.177 163.2)", "oklch(0.2 0.04 163)"] },
  teal: { light: ["oklch(0.511 0.096 186.4)", "oklch(0.985 0 0)"], dark: ["oklch(0.777 0.152 181.9)", "oklch(0.2 0.035 185)"] },
  blue: { light: ["oklch(0.546 0.245 262.9)", "oklch(0.985 0 0)"], dark: ["oklch(0.707 0.165 254.6)", "oklch(0.18 0.04 260)"] },
  indigo: { light: ["oklch(0.511 0.262 276.97)", "oklch(0.985 0 0)"], dark: ["oklch(0.673 0.182 276.9)", "oklch(0.985 0 0)"] },
  violet: { light: ["oklch(0.541 0.281 293)", "oklch(0.985 0 0)"], dark: ["oklch(0.702 0.183 293.5)", "oklch(0.18 0.04 293)"] },
  rose: { light: ["oklch(0.586 0.253 17.6)", "oklch(0.985 0 0)"], dark: ["oklch(0.712 0.194 13.4)", "oklch(0.18 0.04 15)"] },
  orange: { light: ["oklch(0.553 0.195 38.4)", "oklch(0.985 0 0)"], dark: ["oklch(0.75 0.183 55.9)", "oklch(0.2 0.045 50)"] },
};

/** CSS يغيّر لون الأزرار والعناصر البارزة فقط (الخلفيات والنصوص تبقى من تصميم البرنامج). */
export function themeCss(color: string): string | null {
  if (color === "neutral" || !(color in PALETTE)) return null;
  const p = PALETTE[color];
  return (
    `:root{--primary:${p.light[0]};--primary-foreground:${p.light[1]};--ring:${p.light[0]}}` +
    `.dark{--primary:${p.dark[0]};--primary-foreground:${p.dark[1]};--ring:${p.dark[0]}}`
  );
}

/** وضع ثابت يختاره التاجر يغلب تفضيل الزائر (سكربت بقيمة من قائمة ثابتة فقط). */
export function forcedModeScript(mode: PublicTheme["mode"]): string | null {
  if (mode === "dark") return 'document.documentElement.classList.add("dark")';
  if (mode === "light") return 'document.documentElement.classList.remove("dark")';
  return null;
}
