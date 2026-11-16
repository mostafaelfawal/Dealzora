/**
 * الأرقام: رقم رئيسي واحد (صافي المبيعات) + بطاقات. التغيّر بعلامة وسهم ونص (لا لون وحده)،
 * ولونه = الاتجاه × هل الزيادة جيدة (المرتجعات والمصروفات والخصومات: الزيادة سيئة).
 * الرقم الرئيسي يُعدّ من قيمته السابقة للجديدة عند تغيير الفترة، والبطاقات تظهر متدرجة.
 */
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import type { Summary, Totals } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { Money } from "@/components/shared/Money";
import { FadeIn, useCountUp } from "@/components/shared/Motion";
import { formatPiastres } from "@/lib/format";
import { space } from "@/theme/colors";
import { fontFamily } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";

import { change, formatChange } from "../lib/insights";

type Metric = keyof Totals;
type IconName = ComponentProps<typeof Ionicons>["name"];

const TILES: { key: Metric; label: string; upIsGood: boolean; icon: IconName }[] = [
  { key: "revenue", label: "المبيعات", upIsGood: true, icon: "bag-handle-outline" },
  { key: "returns", label: "المرتجعات", upIsGood: false, icon: "return-down-back-outline" },
  { key: "profit", label: "مجمل الربح", upIsGood: true, icon: "trending-up-outline" },
  { key: "discounts", label: "الخصومات", upIsGood: false, icon: "pricetag-outline" },
  { key: "expenses", label: "المصروفات", upIsGood: false, icon: "wallet-outline" },
  { key: "net_profit", label: "صافي الربح", upIsGood: true, icon: "sparkles-outline" },
];

/** شارة التغيّر: خلفية خفيفة بلون الاتجاه + سهم + نسبة، والوصف بجانبها. */
export function Delta({ current, previous, upIsGood, label }: { current: number; previous: number; upIsGood: boolean; label?: string }) {
  const { colors } = useTheme();
  const c = change(current, previous);
  const text = formatChange(c);
  if (!text) return label ? null : <AppText size="xs" tone="muted">—</AppText>;
  const good = c.direction === "flat" ? null : (c.direction === "up") === upIsGood;
  const color = good === null ? colors.mutedForeground : good ? colors.success : colors.destructive;
  const bg = good === null ? colors.muted : good ? colors.successSoft : colors.destructiveSoft;
  const icon = c.direction === "up" ? "arrow-up" : c.direction === "down" ? "arrow-down" : "remove";
  return (
    <View style={styles.delta} accessibilityLabel={`${text}${label ? ` ${label}` : ""}`}>
      <View style={[styles.pill, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={11} color={color} />
        <AppText label size="xs" weight="semibold" style={{ color }}>
          {text}
        </AppText>
      </View>
      {label && (
        <AppText size="xs" tone="muted" style={styles.flex} numberOfLines={1}>
          {label}
        </AppText>
      )}
    </View>
  );
}

interface CompareLabels {
  previous: string;
  weekAgo: string;
}

export function compareLabels(span: number, isToday: boolean): CompareLabels {
  return {
    previous: span === 1 ? (isToday ? "عن أمس" : "عن اليوم السابق") : "عن الفترة السابقة",
    weekAgo: "عن نفس اليوم الأسبوع الماضي",
  };
}

/** الرقم الرئيسي: صافي المبيعات للفترة مع المقارنتين. شريط بلون النص في بداية البطاقة يميّزها عن البقية. */
export function HeroNet({ summary, labels }: { summary: Summary; labels: CompareLabels }) {
  const { colors } = useTheme();
  const { net } = summary.totals;
  const shown = useCountUp(net);
  const { previous, week_ago } = summary.compare;
  return (
    <Card style={[styles.hero, { borderStartColor: colors.foreground }]}>
      <View style={styles.heroHead}>
        <AppText size="sm" tone="muted" weight="medium" style={styles.flex}>
          صافي المبيعات
        </AppText>
        <View style={[styles.countChip, { backgroundColor: colors.muted }]}>
          <Ionicons name="receipt-outline" size={12} color={colors.mutedForeground} />
          <AppText label size="xs" tone="muted" weight="medium">
            {summary.totals.count} فاتورة
          </AppText>
        </View>
      </View>
      <Money
        amount={shown}
        style={styles.heroValue}
        tone={net < 0 ? "destructive" : "default"}
        accessibilityLabel={`صافي المبيعات ${formatPiastres(net)}`}
      />
      <View style={styles.deltas}>
        <Delta current={net} previous={previous.totals.net} upIsGood label={labels.previous} />
        {week_ago && <Delta current={net} previous={week_ago.totals.net} upIsGood label={labels.weekAgo} />}
      </View>
    </Card>
  );
}

export function StatTiles({ summary }: { summary: Summary }) {
  const { colors } = useTheme();
  const prev = summary.compare.previous.totals;
  return (
    <View style={styles.grid}>
      {TILES.map((t, i) => (
        <FadeIn key={t.key} index={i} delay={120} style={styles.tileWrap}>
          <Card style={styles.tile}>
            <View style={styles.tileHead}>
              <AppText size="xs" tone="muted" weight="medium" style={styles.flex} numberOfLines={1}>
                {t.label}
              </AppText>
              <Ionicons name={t.icon} size={15} color={colors.mutedForeground} />
            </View>
            <Money
              amount={summary.totals[t.key]}
              weight="bold"
              size="lg"
              tone={t.key === "net_profit" && summary.totals.net_profit < 0 ? "destructive" : "default"}
            />
            <Delta current={summary.totals[t.key]} previous={prev[t.key]} upIsGood={t.upIsGood} />
          </Card>
        </FadeIn>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: space.xs, borderStartWidth: 3, paddingVertical: space.lg },
  heroHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  countChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2 },
  heroValue: { fontFamily: fontFamily.bold, fontSize: 38, lineHeight: 54, letterSpacing: -0.5 },
  deltas: { gap: 6, marginTop: space.xs },
  delta: { flexDirection: "row", alignItems: "center", gap: space.sm },
  pill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  // عمودان على 360px (16 + 16 هوامش، 8 بينهما)
  tileWrap: { flexBasis: "48%", flexGrow: 1 },
  tile: { flex: 1, gap: 4, padding: space.md },
  tileHead: { flexDirection: "row", alignItems: "center", gap: space.xs },
});
