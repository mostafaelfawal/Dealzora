/**
 * ألوان Dealzora: نفس الهوية المحايدة في frontend/app/globals.css (oklch ← hex).
 * أي تغيير في هوية البرنامج المكتبي يُعكس هنا.
 */

export interface Palette {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
  destructiveSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
}

export const light: Palette = {
  background: "#ffffff", // oklch(1 0 0)
  foreground: "#0a0a0a", // oklch(0.145 0 0)
  card: "#ffffff",
  muted: "#f5f5f5", // oklch(0.97 0 0)
  mutedForeground: "#737373", // oklch(0.556 0 0)
  primary: "#171717", // oklch(0.205 0 0)
  primaryForeground: "#fafafa", // oklch(0.985 0 0)
  secondary: "#f5f5f5",
  border: "#e5e5e5", // oklch(0.922 0 0)
  input: "#e5e5e5",
  ring: "#a3a3a3", // oklch(0.708 0 0)
  destructive: "#e7000b", // oklch(0.577 0.245 27.325)
  destructiveSoft: "#fef2f2",
  success: "#00a63e", // oklch(0.627 0.17 149)
  successSoft: "#f0fdf4",
  warning: "#d97f00", // oklch(0.72 0.16 70) على خلفية فاتحة
  warningSoft: "#fffbeb",
};

export const dark: Palette = {
  background: "#0a0a0a", // oklch(0.145 0 0)
  foreground: "#fafafa", // oklch(0.985 0 0)
  card: "#171717", // oklch(0.205 0 0)
  muted: "#262626", // oklch(0.269 0 0)
  mutedForeground: "#a3a3a3", // oklch(0.708 0 0)
  primary: "#e5e5e5", // oklch(0.922 0 0)
  primaryForeground: "#171717",
  secondary: "#262626",
  border: "rgba(255,255,255,0.10)", // oklch(1 0 0 / 10%)
  input: "rgba(255,255,255,0.15)",
  ring: "#737373",
  destructive: "#ff6467", // oklch(0.704 0.191 22.216)
  destructiveSoft: "rgba(255,100,103,0.12)",
  success: "#05df72",
  successSoft: "rgba(5,223,114,0.12)",
  warning: "#ffb020",
  warningSoft: "rgba(255,176,32,0.12)",
};

/**
 * ألوان الرسوم: أول 3 خانات من اللوحة الفئوية المعتمدة (dataviz)، مُتحقق منها بأداة الفحص
 * للوضعين (فرق CVD ≥ 9.2، الرؤية العادية ≥ 26). الأزرق لسلسلة واحدة، والثلاثة لتوزيع الدفع.
 * الأخضر الفاتح أقل من 3:1 على الأبيض: المبالغ تُكتب دائماً بجانبه في المفتاح (لا لون وحده).
 */
export const chartLight = {
  series1: "#2a78d6",
  series2: "#eb6834",
  series3: "#1baf7a",
  track: "#f0efec",
};
export const chartDark = {
  series1: "#3987e5",
  series2: "#d95926",
  series3: "#199e70",
  track: "#2a2a28",
};

/** حواف حادة مثل البرنامج المكتبي (rounded-none في كل مكوّنات الواجهة). الدوائر للنقاط الصغيرة فقط. */
export const radius = { sm: 0, md: 0, lg: 0 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
