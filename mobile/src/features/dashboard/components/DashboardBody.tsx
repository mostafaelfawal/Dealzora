/**
 * جسم لوحة الفترة (مشترك بين الرئيسية وتفاصيل الفرع): الفترة، الرقم الرئيسي، البطاقات، طرق الدفع،
 * ترتيب الفروع (للمحل)، والاتجاه اليومي. الأرقام المحفوظة تظهر بلا إنترنت مع وقت آخر تحديث.
 * الأقسام تظهر متدرجة أول مرة فقط (تغيير الفترة يحدّث الأرقام في مكانها بلا إعادة دخول).
 */
import type { UseQueryResult } from "@tanstack/react-query";
import { Animated, StyleSheet } from "react-native";

import { errorMessage } from "@/api/errors";
import type { Summary } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { FadeIn, useFadeTo } from "@/components/shared/Motion";
import { DashboardSkeleton } from "@/components/shared/Skeletons";
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
  const opacity = useFadeTo(stale ? 0.5 : 1);

  return (
    <>
      <PeriodPicker preset={preset} range={range} />
      {!summary && query.isPending && <DashboardSkeleton />}
      {!summary && query.isError && (
        <EmptyState icon="alert-circle-outline" title="تعذّر تحميل الأرقام" description={errorMessage(query.error)} />
      )}
      {summary && (
        <Animated.View style={[styles.body, { opacity }]}>
          <CoverageNote summary={summary} singleDay={span === 1} />
          <FadeIn>
            <HeroNet summary={summary} labels={compareLabels(span, today)} />
          </FadeIn>
          <FadeIn index={1} style={styles.meta}>
            <LastUpdated at={query.dataUpdatedAt} label="آخر تحديث من الخادم" />
            {today && (
              <AppText size="xs" tone="muted">
                أرقام اليوم حتى آخر ملخص أرسله كل فرع، والمقارنة بأيام كاملة.
              </AppText>
            )}
          </FadeIn>
          <StatTiles summary={summary} />
          <FadeIn index={8} delay={120}>
            <PaymentSplit totals={summary.totals} />
          </FadeIn>
          {showRanking && summary.branches.length > 1 && (
            <FadeIn index={9} delay={120}>
              <BranchRanking branches={summary.branches} singleDay={span === 1} />
            </FadeIn>
          )}
          {span > 1 && (
            <FadeIn index={10} delay={120}>
              <TrendBars days={summary.days} branchCount={summary.branches_total} />
            </FadeIn>
          )}
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  meta: { gap: 2 },
});
