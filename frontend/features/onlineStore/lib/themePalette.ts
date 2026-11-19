import type { ThemeColor } from "../types/store";

/**
 * ألوان المتجر الجاهزة. نفس القيم في storefront/lib/theme.ts، ونفس المفاتيح في سيرفر الفروع
 * (services/store.THEME_COLORS). light/dark: لون الأزرار في كل وضع مع لون نصها بتباين كافٍ.
 */
export const THEME_PALETTE: Record<
  ThemeColor,
  {
    label: string;
    light: { primary: string; fg: string };
    dark: { primary: string; fg: string };
  }
> = {
  neutral: {
    label: "أسود (افتراضي)",
    light: { primary: "oklch(0.205 0 0)", fg: "oklch(0.985 0 0)" },
    dark: { primary: "oklch(0.922 0 0)", fg: "oklch(0.205 0 0)" },
  },
  emerald: {
    label: "زمردي",
    light: { primary: "oklch(0.508 0.118 165.6)", fg: "oklch(0.985 0 0)" },
    dark: { primary: "oklch(0.765 0.177 163.2)", fg: "oklch(0.2 0.04 163)" },
  },
  teal: {
    label: "فيروزي",
    light: { primary: "oklch(0.511 0.096 186.4)", fg: "oklch(0.985 0 0)" },
    dark: { primary: "oklch(0.777 0.152 181.9)", fg: "oklch(0.2 0.035 185)" },
  },
  blue: {
    label: "أزرق",
    light: { primary: "oklch(0.546 0.245 262.9)", fg: "oklch(0.985 0 0)" },
    dark: { primary: "oklch(0.707 0.165 254.6)", fg: "oklch(0.18 0.04 260)" },
  },
  indigo: {
    label: "نيلي",
    light: { primary: "oklch(0.511 0.262 276.97)", fg: "oklch(0.985 0 0)" },
    dark: { primary: "oklch(0.673 0.182 276.9)", fg: "oklch(0.985 0 0)" },
  },
  violet: {
    label: "بنفسجي",
    light: { primary: "oklch(0.541 0.281 293)", fg: "oklch(0.985 0 0)" },
    dark: { primary: "oklch(0.702 0.183 293.5)", fg: "oklch(0.18 0.04 293)" },
  },
  rose: {
    label: "وردي",
    light: { primary: "oklch(0.586 0.253 17.6)", fg: "oklch(0.985 0 0)" },
    dark: { primary: "oklch(0.712 0.194 13.4)", fg: "oklch(0.18 0.04 15)" },
  },
  orange: {
    label: "برتقالي",
    light: { primary: "oklch(0.553 0.195 38.4)", fg: "oklch(0.985 0 0)" },
    dark: { primary: "oklch(0.75 0.183 55.9)", fg: "oklch(0.2 0.045 50)" },
  },
};

export const THEME_COLORS = Object.keys(THEME_PALETTE) as ThemeColor[];
