/** تفاصيل فرع واحد: حالته وتأخر مزامنته، ثم لوحة الفترة لأرقامه وحده. */
import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Screen } from "@/components/shared/Screen";
import { BranchStatusBadge } from "@/features/branches/components/BranchStatusBadge";
import { useBranch } from "@/features/branches/hooks/useBranches";
import { DashboardBody } from "@/features/dashboard/components/DashboardBody";
import { useSummary } from "@/features/dashboard/hooks/useSummary";
import { statusText, syncLagText } from "@/features/dashboard/lib/insights";
import { usePeriod } from "@/features/dashboard/lib/periodStore";
import { useNow } from "@/hooks/useNow";
import { formatTimeAgo } from "@/lib/format";
import { space } from "@/theme/colors";

export default function BranchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const branch = useBranch(id);
  const { preset, range } = usePeriod();
  const summary = useSummary(range, id);
  const now = useNow();
  const b = branch.data;
  const lag = b ? syncLagText(b.pending_events) : null;

  const refresh = () => {
    void branch.refetch();
    void summary.refetch();
  };

  return (
    <>
      <Stack.Screen options={{ title: b?.name ?? "الفرع" }} />
      <Screen onRefresh={refresh} refreshing={(branch.isRefetching || summary.isRefetching) && !summary.isPlaceholderData}>
        {!b && branch.isError && (
          <EmptyState icon="alert-circle-outline" title="تعذّر فتح الفرع" description={errorMessage(branch.error)} />
        )}
        {b && (
          <Card>
            <View style={styles.head}>
              <AppText weight="bold" size="lg" style={styles.flex}>
                {b.name}
              </AppText>
              <BranchStatusBadge status={b.status} />
            </View>
            <AppText size="sm" tone="muted">
              {statusText(b.status, b.seconds_since_seen)}
            </AppText>
            <AppText size="xs" tone="muted">
              {b.stats_updated_at
                ? `آخر ملخص مبيعات من الفرع: ${formatTimeAgo(b.stats_updated_at, now)}`
                : "لم يرسل الفرع ملخص مبيعات بعد"}
            </AppText>
            {lag && (
              <AppText size="xs" tone={b.status === "online" ? "muted" : "warning"}>
                تأخر المزامنة: {lag}
              </AppText>
            )}
          </Card>
        )}
        {(b || !branch.isError) && <DashboardBody query={summary} preset={preset} range={range} showRanking={false} />}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
});
