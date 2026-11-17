/**
 * توزيع الدفع (نقدي / آجل / محفظة): شريط مقسّم (كل واحد مقسوم لأجزاء) بارتفاع 28 وفواصل 2px بلون السطح،
 * والنسبة داخل الجزء لو اتسع لها. المفتاح يكتب كل اسم ومبلغه ونسبته (اللون لا يحمل المعنى وحده).
 */
import { Animated, StyleSheet, View } from "react-native";

import type { Totals } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { Money } from "@/components/shared/Money";
import { useGrow } from "@/components/shared/Motion";
import { formatPiastres } from "@/lib/format";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

/** أصغر نسبة يُكتب داخلها رقمها (أقل من ذلك يبقى الرقم في المفتاح فقط). */
const LABEL_MIN_SHARE = 0.14;

export function PaymentSplit({ totals }: { totals: Totals }) {
  const { colors, chart } = useTheme();
  const parts = [
    {
      key: "cash",
      label: "نقدي",
      value: Math.max(totals.cash, 0),
      color: chart.series1,
    },
    {
      key: "credit",
      label: "آجل",
      value: Math.max(totals.credit, 0),
      color: chart.series2,
    },
    {
      key: "wallet",
      label: "محفظة",
      value: Math.max(totals.wallet, 0),
      color: chart.series3,
    },
  ];
  const sum = parts.reduce((a, p) => a + p.value, 0);
  // الشريط يمتد من بداية السطر مع كل فترة جديدة
  const grow = useGrow(`${totals.cash}|${totals.credit}|${totals.wallet}`, {
    native: false,
    delay: 200,
  });
  const pct = (v: number) => (sum ? Math.round((v / sum) * 100) : 0);
  const a11y = parts
    .map((p) => `${p.label} ${formatPiastres(p.value)} (${pct(p.value)}%)`)
    .join("، ");

  return (
    <Card>
      <AppText weight="semibold">طرق الدفع</AppText>
      {sum === 0 ? (
        <AppText size="sm" tone="muted">
          لا مدفوعات في هذه الفترة
        </AppText>
      ) : (
        <Animated.View
          style={[
            styles.bar,
            {
              width: grow.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
          accessible
          accessibilityLabel={`توزيع الدفع: ${a11y}`}
        >
          {parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <View
                key={p.key}
                style={[
                  styles.part,
                  {
                    flex: p.value,
                    backgroundColor: p.color,
                    borderColor: colors.card,
                  },
                ]}
              >
                {p.value / sum >= LABEL_MIN_SHARE && (
                  <AppText
                    size="xs"
                    weight="semibold"
                    numberOfLines={1}
                    // الأخضر فاتح: نص داكن عليه، والأزرق والبرتقالي: أبيض (تباين مقروء في الوضعين)
                    style={{
                      color: p.key === "wallet" ? "#0b0b0b" : "#ffffff",
                    }}
                  >
                    {pct(p.value)}%
                  </AppText>
                )}
              </View>
            ))}
        </Animated.View>
      )}
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.key} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <AppText size="sm" style={styles.legendName}>
              {p.label}
            </AppText>
            <Money amount={p.value} size="sm" weight="medium" />
            <AppText size="xs" tone="muted" style={styles.legendPct}>
              {pct(p.value)}%
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", height: 28, marginVertical: space.xs },
  // الفاصل 2px بلون السطح = حد بلون البطاقة بين الأجزاء (لا إطار حول الشكل)
  part: {
    justifyContent: "center",
    paddingHorizontal: 6,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  legend: { gap: space.xs },
  legendRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  swatch: { width: 10, height: 10 },
  legendName: { flex: 1 },
  legendPct: { minWidth: 36, textAlign: "center" },
});
