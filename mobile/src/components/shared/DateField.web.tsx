/** نسخة الويب (PWA): حقل التاريخ في المتصفح (على الآيفون يفتح منتقي Safari الأصلي). */
import { useTheme } from "@/theme/ThemeProvider";
import { toIsoDay, parseIsoDay } from "@/lib/period";

import type { DateFieldProps } from "./DateField";

export function DateField({ value, maximumDate, onPick }: DateFieldProps) {
  const { colors } = useTheme();
  return (
    <input
      type="date"
      value={toIsoDay(value)}
      max={maximumDate ? toIsoDay(maximumDate) : undefined}
      onChange={(e) =>
        onPick(
          e.currentTarget.value ? parseIsoDay(e.currentTarget.value) : null,
        )
      }
      style={{
        fontSize: 16, // أقل من 16 يجعل Safari يكبّر الصفحة عند الضغط
        padding: 10,
        border: `1px solid ${colors.input}`,
        borderRadius: 0,
        background: colors.card,
        color: colors.foreground,
        colorScheme: "light dark",
      }}
    />
  );
}
