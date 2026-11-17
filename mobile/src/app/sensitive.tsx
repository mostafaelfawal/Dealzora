/**
 * العمليات الحساسة كتنبيهات: خصم كاشير أو مرتجع فوق حد المالك، ومرتجع فاتورة كاملة (يقابل «إلغاء فاتورة»:
 * البرنامج لا يلغي الفواتير ولا يسمح بتغيير السعر عند البيع، فهذه هي العمليات الفعلية).
 */
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type { SensitiveType } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { Screen } from "@/components/shared/Screen";
import { ListSkeleton } from "@/components/shared/Skeletons";
import { PeriodPicker } from "@/features/dashboard/components/PeriodPicker";
import { usePeriod } from "@/features/dashboard/lib/periodStore";
import { useSensitive } from "@/features/reports/hooks/useReports";
import { SENSITIVE_LABEL } from "@/features/reports/lib/reportText";
import { formatDateTime } from "@/lib/format";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

const ICON: Record<SensitiveType, ComponentProps<typeof Ionicons>["name"]> = {
  discount: "pricetag-outline",
  return: "return-down-back-outline",
  full_return: "close-circle-outline",
};

export default function SensitiveRoute() {
  const { colors } = useTheme();
  const { preset, range } = usePeriod();
  const q = useSensitive(range);
  const rows = q.data ?? [];

  return (
    <Screen
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching && !q.isPlaceholderData}
    >
      <PeriodPicker preset={preset} range={range} />
      <AppText size="xs" tone="muted">
        الحدود يحددها المالك (المزيد ← حدود العمليات الحساسة)، وتصل للفروع مع
        مزامنتها.
      </AppText>
      {q.isPending && <ListSkeleton count={4} />}
      {q.isError && !q.data && (
        <EmptyState
          icon="alert-circle-outline"
          title="تعذّر التحميل"
          description={errorMessage(q.error)}
        />
      )}
      {rows.map((r) => (
        <Card
          key={r.id}
          style={[styles.row, q.isPlaceholderData && styles.stale]}
        >
          <Ionicons
            name={ICON[r.data.type]}
            size={22}
            color={
              r.data.type === "full_return"
                ? colors.destructive
                : colors.warning
            }
          />
          <View style={styles.flex}>
            <AppText weight="semibold">{SENSITIVE_LABEL[r.data.type]}</AppText>
            <AppText size="sm" tone="muted">
              {r.branch_name} · {r.data.cashier} ·{" "}
              {r.data.type === "return" ? "مرتجع" : "فاتورة"} #{r.data.number}
            </AppText>
            {r.at && (
              <AppText size="xs" tone="muted">
                {formatDateTime(r.at)}
              </AppText>
            )}
          </View>
          <View style={styles.amount}>
            <Money amount={r.data.amount} weight="bold" size="sm" />
            {r.data.type === "discount" && (
              <AppText size="xs" tone="muted">
                من{" "}
                <Money
                  amount={r.data.total}
                  size="xs"
                  tone="muted"
                  hideCurrency
                />
              </AppText>
            )}
          </View>
        </Card>
      ))}
      {q.data && rows.length === 0 && (
        <EmptyState
          icon="shield-checkmark-outline"
          title="لا عمليات حساسة في هذه الفترة"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  amount: { alignItems: "flex-end", maxWidth: 120 },
  stale: { opacity: 0.55 },
});
