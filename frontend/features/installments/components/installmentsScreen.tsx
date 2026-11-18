"use client";

import {
  IconAlarm,
  IconCalendarDollar,
  IconCalendarDue,
  IconCash,
  IconCircleCheck,
  IconCoins,
  IconListDetails,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import { listItem, MotionLi } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeSearch } from "@/features/pos/lib/posCalc";
import { addDays, toIsoDay, todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { usePlans, usePlansSummary } from "../hooks/useInstallments";
import {
  FREQUENCY_LABEL,
  isoDate,
  matchesFilter,
  matchesPlan,
  PLAN_FILTERS,
  planBadge,
  relativeDue,
} from "../lib/installmentText";
import type { InstallmentPlan, PlanFilter } from "../types/installment";
import { InstallmentDetailsDialog } from "./installmentDetailsDialog";
import { InstallmentFormDialog } from "./installmentFormDialog";
import { PayInstallmentDialog } from "./payInstallmentDialog";

function PlanCard({
  p,
  index,
  onOpen,
  onPay,
}: {
  p: InstallmentPlan;
  index: number;
  onOpen: () => void;
  onPay: () => void;
}) {
  const badge = planBadge(p);
  const progress = p.total > 0 ? Math.min(p.paidAmount / p.total, 1) : 0;
  const overdue = p.overdueCount > 0;
  return (
    <MotionLi
      {...listItem(index)}
      className={cn(
        "flex flex-col gap-3 border bg-card p-4",
        overdue && "border-destructive/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center",
            overdue
              ? "bg-destructive/10 text-destructive"
              : p.status === "completed"
                ? "bg-success/10 text-success"
                : "bg-primary/10 text-primary",
          )}
        >
          <IconCalendarDollar className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <AppTooltip message={p.customerName} onlyWhenTruncated>
            <p className="truncate font-semibold">{p.customerName}</p>
          </AppTooltip>
          <AppTooltip message={p.title} onlyWhenTruncated>
            <p className="truncate text-sm text-muted-foreground">{p.title}</p>
          </AppTooltip>
        </div>
        <span
          className={cn("shrink-0 px-1.5 py-0.5 text-[11px]", badge.className)}
        >
          {badge.label}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>
            {p.paidCount} من {p.installmentsCount} قسط
          </span>
          <span className="flex items-baseline gap-1">
            المتبقي{" "}
            <Money amount={p.remaining} className="text-sm text-foreground" />
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="نسبة السداد"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="h-1.5 w-full bg-muted"
        >
          <div
            className={cn(
              "h-full transition-[width]",
              overdue ? "bg-destructive" : "bg-success",
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <dl className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <IconCoins className="size-3.5" />
          <dd className="flex items-baseline gap-1">
            <Money amount={p.installmentAmount} className="text-foreground" />
            {FREQUENCY_LABEL[p.frequency]}
          </dd>
        </div>
        {p.status === "active" && p.nextDueDate ? (
          <div
            className={cn(
              "flex items-center gap-1",
              overdue && "text-destructive",
            )}
          >
            {overdue ? (
              <IconAlarm className="size-3.5" />
            ) : (
              <IconCalendarDue className="size-3.5" />
            )}
            <dd className="flex flex-wrap items-baseline gap-1">
              {overdue ? (
                <>
                  متأخرات{" "}
                  <Money
                    amount={p.overdueAmount}
                    className="text-destructive"
                  />
                  · منذ {isoDate(p.nextDueDate)}
                </>
              ) : (
                <>
                  القسط القادم {isoDate(p.nextDueDate)} (
                  {relativeDue(p.nextDueDate)})
                </>
              )}
            </dd>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <IconCalendarDue className="size-3.5" />
            <dd>
              {isoDate(p.startDate)} ← {isoDate(p.endDate)}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-auto flex gap-1.5 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onOpen}
        >
          <IconListDetails className="size-4" />
          الجدول
        </Button>
        {p.status === "active" && (
          <Button size="sm" className="ms-auto gap-1.5" onClick={onPay}>
            <IconCash className="size-4" />
            تحصيل قسط
          </Button>
        )}
      </div>
    </MotionLi>
  );
}

/** التقسيط: خطط أقساط على العملاء بمقدّم وبلا فائدة، ومتابعة المستحق والمتأخر. */
export function InstallmentsScreen() {
  const query = usePlans();
  const summary = usePlansSummary().data;
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [paying, setPaying] = useState<InstallmentPlan | null>(null);
  const [filter, setFilter] = useState<PlanFilter>("active");
  const [search, setSearch] = useState("");

  const items = useMemo(() => query.data ?? [], [query.data]);
  const today = todayIso();
  const week = toIsoDay(addDays(new Date(), 7));
  const q = normalizeSearch(search);
  const shown = useMemo(
    () =>
      items
        .filter((p) => matchesFilter(p, filter, today, week))
        .filter((p) => matchesPlan(p, q))
        // الأحوج للمتابعة أولاً: المتأخر ثم الأقرب استحقاقاً.
        .sort(
          (a, b) =>
            b.overdueAmount - a.overdueAmount ||
            (a.nextDueDate ?? "9999").localeCompare(b.nextDueDate ?? "9999"),
        ),
    [items, filter, today, week, q],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        PLAN_FILTERS.map((f) => [
          f.id,
          items.filter((p) => matchesFilter(p, f.id, today, week)).length,
        ]),
      ) as Record<PlanFilter, number>,
    [items, today, week],
  );
  const tile = (f: PlanFilter) => ({
    active: filter === f,
    onClick: () => setFilter(filter === f ? "all" : f),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="التقسيط"
        description="قسّط المبيعات ومديونيات العملاء على أقساط بمقدّم وبلا أي فائدة، وتابع المستحق والمتأخر من مكان واحد. كل قسط يُسجَّل في كشف حساب العميل وفي الخزنة."
        actions={
          <Button
            size="lg"
            className="h-10 gap-2"
            onClick={() => setCreating(true)}
          >
            <IconPlus className="size-4" />
            خطة جديدة
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          index={0}
          icon={<IconCalendarDollar />}
          label="خطط جارية"
          hint={
            summary ? (
              <>
                متبقٍ <Money amount={summary.remaining} />
              </>
            ) : undefined
          }
          {...tile("active")}
        >
          {summary?.active ?? "—"}
        </StatTile>
        <StatTile
          index={1}
          icon={<IconAlarm />}
          label="متأخرة"
          tone="danger"
          hint={summary ? <Money amount={summary.overdueAmount} /> : undefined}
          {...tile("overdue")}
        >
          {summary?.overduePlans ?? "—"}
        </StatTile>
        <StatTile
          index={2}
          icon={<IconCalendarDue />}
          label="تستحق هذا الأسبوع"
          tone="warning"
          hint={summary ? <Money amount={summary.dueSoonAmount} /> : undefined}
          {...tile("due_soon")}
        >
          {summary?.dueSoonPlans ?? "—"}
        </StatTile>
        <StatTile
          index={3}
          icon={<IconCircleCheck />}
          label="مكتملة"
          tone="success"
          hint={
            summary ? (
              <>
                محصّل <Money amount={summary.collected} />
              </>
            ) : undefined
          }
          {...tile("completed")}
        >
          {summary?.completed ?? "—"}
        </StatTile>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SegmentedTabs
          label="حالة الخطط"
          items={PLAN_FILTERS.map((f) => ({ ...f, count: counts[f.id] }))}
          value={filter}
          onChange={setFilter}
          className="min-w-0 flex-1"
        />
        <div className="relative sm:w-64">
          <IconSearch className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالعميل أو الهاتف أو الصنف"
            aria-label="بحث في خطط التقسيط"
            className="h-10 ps-8"
          />
        </div>
      </div>

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border bg-card p-10 text-center">
          <IconCalendarDollar className="size-10 text-muted-foreground" />
          <p className="font-medium">
            {items.length ? "لا خطط هنا" : "لا توجد خطط تقسيط بعد"}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            بِع ثلاجة بمقدّم 20% والباقي على 10 أشهر، أو قسّط مديونية عميل متراكمة
            على أقساط أسبوعية، وتظهر الأقساط المتأخرة والمستحقة هذا الأسبوع في
            أعلى الصفحة.
          </p>
          {!items.length && (
            <Button onClick={() => setCreating(true)} className="gap-2">
              <IconPlus className="size-4" />
              أول خطة تقسيط
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p, i) => (
            <PlanCard
              key={p.id}
              p={p}
              index={i}
              onOpen={() => setOpenId(p.id)}
              onPay={() => setPaying(p)}
            />
          ))}
        </ul>
      )}

      <InstallmentFormDialog
        open={creating}
        onClose={() => setCreating(false)}
      />
      <InstallmentDetailsDialog
        planId={openId}
        onClose={() => setOpenId(null)}
        onPay={(p) => {
          setOpenId(null);
          setPaying(p);
        }}
      />
      <PayInstallmentDialog plan={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
