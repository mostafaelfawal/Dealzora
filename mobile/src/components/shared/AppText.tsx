import { useState, type ReactNode } from "react";
import { Platform, Text, type LayoutChangeEvent, type TextProps } from "react-native";

import { fontFamily, fontSize, type FontWeight } from "@/theme/fonts";
import { rtlText } from "@/theme/rtl";
import { useTheme } from "@/theme/ThemeProvider";

type Tone = "default" | "muted" | "destructive" | "success" | "warning" | "inverse";

export interface AppTextProps extends TextProps {
  weight?: FontWeight;
  size?: keyof typeof fontSize;
  tone?: Tone;
  center?: boolean;
  /**
   * نص قصير عرضه على قد محتواه (شريحة، زر، شارة). أندرويد يقيس عرض النص العربي بالخط المخصص
   * أقل قليلاً من عرض رسمه، فيلتف آخر حرف/كلمة لسطر مخفي («هذا الشهر» ← «هذا»، «أمس» ← «أم»).
   * مع label: بعد أول قياس يُضاف للنص هامش أمان كحد أدنى للعرض (أندرويد فقط؛ iOS يقيس صحيحاً).
   */
  label?: boolean;
}

const ANDROID = Platform.OS === "android";

/** نص الأبناء ({count} فاتورة = مصفوفة): أي تغيّر فيه يعني قياساً جديداً. */
function plainText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(plainText).join("");
  return "";
}

/** كل نصوص التطبيق: الخط العربي، محاذاة RTL، ولون الوضع الحالي. */
export function AppText({
  weight = "regular",
  size = "md",
  tone = "default",
  center,
  label,
  style,
  onLayout,
  children,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  // العرض الأدنى مرتبط بالنص الذي قيس له (نص جديد أو خط مختلف = قياس جديد)
  const measureKey = `${weight}|${size}|${plainText(children)}`;
  const [fix, setFix] = useState<{ key: string; minWidth: number } | null>(null);
  const fixWidth = ANDROID && label;
  const minWidth = fixWidth && fix?.key === measureKey ? fix.minWidth : undefined;

  const handleLayout = (e: LayoutChangeEvent) => {
    onLayout?.(e);
    if (!fixWidth || fix?.key === measureKey) return;
    // هامش ≈ عرض حرف عربي عريض بهذا الحجم (أكبر من الفرق الملحوظ بين القياس والرسم)
    const slack = Math.ceil(fontSize[size] * 0.7);
    setFix({ key: measureKey, minWidth: Math.ceil(e.nativeEvent.layout.width) + slack });
  };

  const color = {
    default: colors.foreground,
    muted: colors.mutedForeground,
    destructive: colors.destructive,
    success: colors.success,
    warning: colors.warning,
    inverse: colors.primaryForeground,
  }[tone];
  return (
    <Text
      textBreakStrategy="simple"
      {...rest}
      onLayout={fixWidth || onLayout ? handleLayout : undefined}
      style={[
        rtlText,
        { fontFamily: fontFamily[weight], fontSize: fontSize[size], lineHeight: Math.round(fontSize[size] * 1.6), color },
        (center || fixWidth) && { textAlign: "center" },
        minWidth !== undefined && { minWidth },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
