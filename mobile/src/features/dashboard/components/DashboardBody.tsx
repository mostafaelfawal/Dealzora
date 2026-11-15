/**
 * جسم لوحة الفترة (مشترك بين الرئيسية وتفاصيل الفرع): الفترة، الرقم الرئيسي، البطاقات، طرق الدفع،
 * ترتيب الفروع (للمحل)، والاتجاه اليومي. الأرقام المحفوظة تظهر بلا إنترنت مع وقت آخر تحديث.
 */
import type { UseQueryResult } from "@tanstack/react-query";
import { StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type { Summary } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { includesToday, rangeDays, type DateRange, type PeriodPreset } from "@/lib/period";
import { space } from "@/theme/colors";

import { BranchRanking } from "./BranchRanking";
import { CoverageNote } from "./CoverageNote";
import { HeroNet, StatTiles, compareLabels } from "./Figures";
import { PaymentSplit } from "./PaymentSplit";
import { PeriodPicker } from "./PeriodPicker";
import { TrendBars } from "./TrendBars";

interface Props {
  query: UseQueryResult<Summary>;
  preset: PeriodPreset;
  range: DateRange;
  /** ترتيب الفروع يظهر في لوحة المحل فقط (لا في تفاصيل فرع واحد). */
  showRanking: boolean;
}

export function DashboardBody({ query, preset, range, showRanking }: Props) {
  const summary = query.data;
  const span = rangeDays(range);
  const today = includesToday(range);
  // بيانات فترة سابقة ظاهرة حتى تصل الجديدة: باهتة
  const stale = query.isPlaceholderData;

  return (
    <>
      <PeriodPicker preset={preset} range={range} />
      {!summary && query.isPending && <AppText tone="muted">جارٍ التحميل…</AppText>}
      {!summary && query.isError && (
        <EmptyState icon="alert-circle-outline" title="تعذّر تحميل الأرقام" description={errorMessage(query.error)} />
      )}
      {summary && (
        <View style={[styles.body, stale && styles.stale]}>
          <CoverageNote summary={summary} singleDay={span === 1} />
          <HeroNet summary={summary} labels={compareLabels(span, today)} />
          <View style={styles.meta}>
            <LastUpdated at={query.dataUpdatedAt} label="آخر تحديث من الخادم" />
            {today && (
              <AppText size="xs" tone="muted">
                أرقام اليوم حتى آخر ملخص أرسله كل فرع، والمقارنة بأيام كاملة.
              </AppText>
            )}
          </View>
          <StatTiles summary={summary} />
          <PaymentSplit totals={summary.totals} />
          {showRanking && summary.branches.length > 1 && (
            <BranchRanking branches={summary.branches} singleDay={span === 1} />
          )}
          {span > 1 && <TrendBars days={summary.days} branchCount={summary.branches_total} />}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  stale: { opacity: 0.55 },
  meta: { gap: 2 },
});
