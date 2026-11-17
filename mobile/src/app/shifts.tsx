/** الورديات: إغلاق كل وردية بفرق النقدية لكل كاشير (عجز/زيادة)، في الفترة المختارة. */
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { Screen } from "@/components/shared/Screen";
import { ListSkeleton } from "@/components/shared/Skeletons";
import { PeriodPicker } from "@/features/dashboard/components/PeriodPicker";
import { usePeriod } from "@/features/dashboard/lib/periodStore";
import { useShifts } from "@/features/reports/hooks/useReports";
import { CASH_LABEL, cashTone } from "@/features/reports/lib/reportText";
import { formatDateTime } from "@/lib/format";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

export default function ShiftsRoute() {
  const { colors } = useTheme();
  const { preset, range } = usePeriod();
  const q = useShifts(range);
  const rows = q.data ?? [];
  const shortTotal = rows.reduce(
    (a, r) => a + Math.min(r.data.difference, 0),
    0,
  );

  return (
    <Screen
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching && !q.isPlaceholderData}
    >
      <PeriodPicker preset={preset} range={range} />
      {q.isPending && <ListSkeleton count={4} />}
      {q.isError && !q.data && (
        <EmptyState
          icon="alert-circle-outline"
          title="تعذّر التحميل"
          description={errorMessage(q.error)}
        />
      )}
      {rows.length > 0 && (
        <Card>
          <AppText size="sm" tone="muted">
            {rows.length} وردية مغلقة · إجمالي العجز
          </AppText>
          <Money
            amount={Math.abs(shortTotal)}
            weight="bold"
            size="xl"
            tone={shortTotal < 0 ? "destructive" : "default"}
          />
        </Card>
      )}
      {rows.map((r) => {
        const tone = cashTone(r.data);
        const color =
          tone === "short"
            ? colors.destructive
            : tone === "over"
              ? colors.warning
              : colors.success;
        return (
          <Card key={r.id} style={q.isPlaceholderData && styles.stale}>
            <View style={styles.head}>
              <View style={styles.flex}>
                <AppText weight="semibold">
                  {r.data.cashier} · {r.branch_name}
                </AppText>
                <AppText size="xs" tone="muted">
                  أُغلقت {formatDateTime(r.data.closed_at)}
                </AppText>
              </View>
              <View style={styles.badge} accessibilityLabel={CASH_LABEL[tone]}>
                <Ionicons
                  name={tone === "ok" ? "checkmark-circle" : "alert-circle"}
                  size={16}
                  color={color}
                />
                <AppText size="xs" weight="semibold" style={{ color }}>
                  {CASH_LABEL[tone]}
                </AppText>
              </View>
            </View>
            <View style={styles.row}>
              <AppText size="sm" tone="muted" style={styles.flex}>
                المتوقع
              </AppText>
              <Money amount={r.data.expected} size="sm" />
            </View>
            <View style={styles.row}>
              <AppText size="sm" tone="muted" style={styles.flex}>
                المعدود
              </AppText>
              <Money amount={r.data.counted} size="sm" />
            </View>
            {tone !== "ok" && (
              <View style={styles.row}>
                <AppText
                  size="sm"
                  weight="semibold"
                  style={[styles.flex, { color }]}
                >
                  {CASH_LABEL[tone]}
                </AppText>
                <Money
                  amount={Math.abs(r.data.difference)}
                  size="sm"
                  weight="bold"
                  style={{ color }}
                />
              </View>
            )}
          </Card>
        );
      })}
      {q.data && rows.length === 0 && (
        <EmptyState
          icon="time-outline"
          title="لا ورديات مغلقة في هذه الفترة"
          description="تظهر هنا بعد إغلاق الوردية ومزامنة الفرع"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  badge: { flexDirection: "row", alignItems: "center", gap: 4 },
  stale: { opacity: 0.55 },
});
