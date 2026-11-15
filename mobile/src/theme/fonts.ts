/**
 * IBM Plex Sans Arabic (نفس خط البرنامج المكتبي). على أندرويد الأوزان لا تُصنَّع من خط مخصص،
 * فكل وزن عائلة مستقلة (اسم الملف المُحمَّل في useFonts).
 */
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";

export const fontAssets = {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
};

export type FontWeight = "regular" | "medium" | "semibold" | "bold";

export const fontFamily: Record<FontWeight, string> = {
  regular: "IBMPlexSansArabic_400Regular",
  medium: "IBMPlexSansArabic_500Medium",
  semibold: "IBMPlexSansArabic_600SemiBold",
  bold: "IBMPlexSansArabic_700Bold",
};

export const fontSize = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 26 } as const;
