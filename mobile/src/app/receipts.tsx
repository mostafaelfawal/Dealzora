/**
 * الإيصالات الإلكترونية (منظومة الضرائب): لكل فرع عدد المنتظر والمقبول والمرفوض في الفترة، من الملخص اليومي
 * الذي يرفعه الفرع. التطبيق للمتابعة فقط: التصحيح وإعادة الإرسال من جهاز الفرع نفسه.
 */
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type { BranchTotals, Totals } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { Screen } from "@/components/shared/Screen";
import { ListSkeleton } from "@/components/shared/Skeletons";
import { PeriodPicker } from "@/features/dashboard/components/PeriodPicker";
import { useSummary } from "@/features/dashboard/hooks/useSummary";
import {
  branchCoverage,
  coverageLabel,
} from "@/features/dashboard/lib/insights";
import { usePeriod } from "@/features/dashboard/lib/periodStore";
import { useNow } from "@/hooks/useNow";
import { formatTimeAgo } from "@/lib/format";
import { rangeDays } from "@/lib/period";
import { radius, space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

function Counts({
  t,
}: {
  t: Pick<Totals, "eta_waiting" | "eta_accepted" | "eta_rejected">;
}) {
  const { colors } = useTheme();
  const cells = [
    {
      label: "لم يصل بعد",
      value: t.eta_waiting,
      color: colors.warning,
      icon: "time-outline" as const,
    },
    {
      label: "مقبول",
      value: t.eta_accepted,
      color: colors.success,
      icon: "checkmark-circle-outline" as const,
    },
    {
      label: "مرفوض",
      value: t.eta_rejected,
      color: colors.destructive,
      icon: "close-circle-outline" as const,
    },
  ];
  return (
    <View style={styles.counts}>
      {cells.map((c) => (
        <View
          key={c.label}
          style={[styles.cell, { borderColor: colors.border }]}
          accessible
          accessibilityLabel={`${c.label}: ${c.value}`}
        >
          <Ionicons name={c.icon} size={16} color={c.color} />
          <AppText weight="bold" size="lg">
            {c.value}
          </AppText>
          <AppText size="xs" tone="muted">
            {c.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export default function ReceiptsRoute() {
  const { colors } = useTheme();
  const { preset, range } = usePeriod();
  const q = useSummary(range);
  const now = useNow();
  const s = q.data;
  const singleDay = rangeDays(range) === 1;
  // الأكثر مرفوضاً أولاً: هو ما يحتاج تصرفاً.
  const branches = [...(s?.branches ?? [])].sort(
    (a, b) => b.eta_rejected - a.eta_rejected || b.eta_waiting - a.eta_waiting,
  );

  return (
    <Screen
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching && !q.isPlaceholderData}
    >
      <View
        style={[
          styles.note,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={colors.mutedForeground}
        />
        <AppText size="sm" style={styles.flex}>
          المتابعة فقط من هنا. تصحيح الإيصال المرفوض وإعادة إرساله يتم من جهاز
          الفرع نفسه (البرنامج ← الإيصالات الإلكترونية).
        </AppText>
      </View>
      <PeriodPicker preset={preset} range={range} />
      {!s && q.isPending && <ListSkeleton count={3} />}
      {!s && q.isError && (
        <EmptyState
          icon="alert-circle-outline"
          title="تعذّر التحميل"
          description={errorMessage(q.error)}
        />
      )}
      {s && (
        <View style={[styles.body, q.isPlaceholderData && styles.stale]}>
          <Card>
            <AppText weight="semibold">كل الفروع</AppText>
            <Counts t={s.totals} />
            <LastUpdated at={q.dataUpdatedAt} label="آخر تحديث من الخادم" />
          </Card>
          {branches.map((b: BranchTotals) => {
            const note = coverageLabel(b, singleDay);
            return (
              <Card key={b.id}>
                <View style={styles.head}>
                  <AppText weight="semibold" style={styles.flex}>
                    {b.name}
                  </AppText>
                  {b.eta_rejected > 0 && (
                    <AppText size="xs" weight="semibold" tone="destructive">
                      يحتاج تصحيحاً من الفرع
                    </AppText>
                  )}
                </View>
                {branchCoverage(b) === "none" ? (
                  <AppText size="sm" tone="warning">
                    {note}
                  </AppText>
                ) : (
                  <Counts t={b} />
                )}
                <AppText size="xs" tone="muted">
                  {b.last_update
                    ? `آخر تحديث من الفرع: ${formatTimeAgo(b.last_update, now)}`
                    : "لا تحديثات من الفرع في هذه الفترة"}
                  {note && branchCoverage(b) === "partial" ? ` · ${note}` : ""}
                </AppText>
              </Card>
            );
          })}
          <AppText size="xs" tone="muted">
            الأعداد حسب يوم إصدار الإيصال (بيع ومرتجع)، كما يرفعها كل فرع مع
            ملخصه اليومي. فرع بنسخة أقدم من البرنامج قد يظهر بأصفار.
          </AppText>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: "row",
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  flex: { flex: 1 },
  body: { gap: space.md },
  stale: { opacity: 0.55 },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  counts: { flexDirection: "row", gap: space.sm },
  cell: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.sm,
    alignItems: "center",
    gap: 2,
  },
});
