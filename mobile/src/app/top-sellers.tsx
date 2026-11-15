/** الأكثر مبيعاً بالإيراد في الفترة (مجموع قوائم الفروع اليومية). شريط أفقي لسلسلة واحدة + الرقم مكتوب. */
import { StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { Money } from "@/components/shared/Money";
import { Screen } from "@/components/shared/Screen";
import { PeriodPicker } from "@/features/dashboard/components/PeriodPicker";
import { usePeriod } from "@/features/dashboard/lib/periodStore";
import { useTopSellers } from "@/features/reports/hooks/useReports";
import { formatQty } from "@/features/transfers/lib/transferText";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

export default function TopSellersRoute() {
  const { chart } = useTheme();
  const { preset, range } = usePeriod();
  const q = useTopSellers(range);
  const rows = q.data ?? [];
  const max = Math.max(...rows.map((r) => r.revenue), 1);

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching && !q.isPlaceholderData}>
      <PeriodPicker preset={preset} range={range} />
      <LastUpdated at={q.dataUpdatedAt} label="آخر تحديث من الخادم" />
      {q.isPending && <AppText tone="muted">جارٍ التحميل…</AppText>}
      {q.isError && !q.data && <EmptyState icon="alert-circle-outline" title="تعذّر التحميل" description={errorMessage(q.error)} />}
      {rows.length > 0 && (
        <Card style={q.isPlaceholderData && styles.stale}>
          {rows.map((r, i) => (
            <View key={r.key} style={styles.row}>
              <View style={styles.head}>
                <AppText size="sm" tone="muted" style={styles.rank}>
                  {i + 1}
                </AppText>
                <AppText weight="medium" style={styles.flex} numberOfLines={1}>
                  {r.name}
                </AppText>
                <Money amount={r.revenue} size="sm" weight="semibold" />
              </View>
              <View style={[styles.track, { backgroundColor: chart.track }]}>
                <View style={[styles.bar, { width: `${(Math.max(r.revenue, 0) / max) * 100}%`, backgroundColor: chart.series1 }]} />
              </View>
              <AppText size="xs" tone="muted">
                {formatQty(r.qty)} {r.unit}
                {r.branches > 1 ? ` · ${r.branches} فروع` : ""}
              </AppText>
            </View>
          ))}
        </Card>
      )}
      {q.data && rows.length === 0 && <EmptyState icon="podium-outline" title="لا مبيعات في هذه الفترة بعد" />}
      <AppText size="xs" tone="muted">
        أعلى 20 صنفاً لكل فرع يومياً، قبل خصم المرتجعات.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4, paddingVertical: space.xs },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rank: { width: 18, textAlign: "center" },
  flex: { flex: 1 },
  track: { height: 8, overflow: "hidden", flexDirection: "row" },
  bar: { height: "100%" },
  stale: { opacity: 0.55 },
});
