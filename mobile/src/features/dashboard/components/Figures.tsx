/**
 * الأرقام: رقم رئيسي واحد (صافي المبيعات) + بطاقات. التغيّر بعلامة وسهم ونص (لا لون وحده)،
 * ولونه = الاتجاه × هل الزيادة جيدة (المرتجعات والمصروفات والخصومات: الزيادة سيئة).
 */
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import type { Summary, Totals } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { Money } from "@/components/shared/Money";
import { space } from "@/theme/colors";
import { fontFamily } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";

import { change, formatChange } from "../lib/insights";

type Metric = keyof Totals;

const TILES: { key: Metric; label: string; upIsGood: boolean }[] = [
  { key: "revenue", label: "المبيعات", upIsGood: true },
  { key: "returns", label: "المرتجعات", upIsGood: false },
  { key: "profit", label: "مجمل الربح", upIsGood: true },
  { key: "discounts", label: "الخصومات", upIsGood: false },
  { key: "expenses", label: "المصروفات", upIsGood: false },
  { key: "net_profit", label: "صافي الربح", upIsGood: true },
];

export function Delta({ current, previous, upIsGood, label }: { current: number; previous: number; upIsGood: boolean; label?: string }) {
  const { colors } = useTheme();
  const c = change(current, previous);
  const text = formatChange(c);
  if (!text) return label ? null : <AppText size="xs" tone="muted">—</AppText>;
  const good = c.direction === "flat" ? null : (c.direction === "up") === upIsGood;
  const color = good === null ? colors.mutedForeground : good ? colors.success : colors.destructive;
  const icon = c.direction === "up" ? "arrow-up" : c.direction === "down" ? "arrow-down" : "remove";
  return (
    <View style={styles.delta} accessibilityLabel={`${text}${label ? ` ${label}` : ""}`}>
      <Ionicons name={icon} size={12} color={color} />
      <AppText size="xs" weight="semibold" style={{ color }}>
        {text}
      </AppText>
      {label && (
        <AppText size="xs" tone="muted">
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

/** الرقم الرئيسي: صافي المبيعات للفترة مع المقارنتين. */
export function HeroNet({ summary, labels }: { summary: Summary; labels: CompareLabels }) {
  const { net } = summary.totals;
  const { previous, week_ago } = summary.compare;
  return (
    <Card style={styles.hero}>
      <AppText size="sm" tone="muted">
        صافي المبيعات
      </AppText>
      <Money amount={net} style={styles.heroValue} accessibilityLabel="صافي المبيعات" />
      <AppText size="xs" tone="muted">
        {summary.totals.count} فاتورة
      </AppText>
      <View style={styles.deltas}>
        <Delta current={net} previous={previous.totals.net} upIsGood label={labels.previous} />
        {week_ago && <Delta current={net} previous={week_ago.totals.net} upIsGood label={labels.weekAgo} />}
      </View>
    </Card>
  );
}

export function StatTiles({ summary }: { summary: Summary }) {
  const prev = summary.compare.previous.totals;
  return (
    <View style={styles.grid}>
      {TILES.map((t) => (
        <Card key={t.key} style={styles.tile}>
          <AppText size="xs" tone="muted">
            {t.label}
          </AppText>
          <Money amount={summary.totals[t.key]} weight="semibold" size="lg" tone={t.key === "net_profit" && summary.totals.net_profit < 0 ? "destructive" : "default"} />
          <Delta current={summary.totals[t.key]} previous={prev[t.key]} upIsGood={t.upIsGood} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 2 },
  heroValue: { fontFamily: fontFamily.bold, fontSize: 36, lineHeight: 52 },
  deltas: { gap: 2, marginTop: space.xs },
  delta: { flexDirection: "row", alignItems: "center", gap: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  // عمودان على 360px (16 + 16 هوامش، 8 بينهما)
  tile: { flexBasis: "48%", flexGrow: 1, gap: 2, padding: space.md },
});
