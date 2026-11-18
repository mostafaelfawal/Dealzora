"use client";

import {
  IconAlertTriangle,
  IconCash,
  IconCircleCheck,
  IconCircleDashed,
  IconPackageOff,
  IconReceipt,
  IconShoppingBag,
  IconTruckDelivery,
} from "@tabler/icons-react";

import { ChartCard, ChartEmpty } from "@/components/shared/charts/ChartCard";
import { RankBarChart } from "@/components/shared/charts/RankBarChart";
import { TrendChart } from "@/components/shared/charts/TrendChart";
import { Money } from "@/components/shared/Money";
import { StatTile } from "@/components/shared/StatTile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate, formatWhen, parseIsoDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { useStoreSummary } from "../hooks/useOnlineStore";
import type { StoreSettings } from "../types/store";
import { StatusBadge } from "./orderDetailSheet";

export type StoreTab = "overview" | "orders" | "products" | "settings";

function Checklist({
  store,
  published,
  onGo,
}: {
  store: StoreSettings;
  published: number;
  onGo: (t: StoreTab) => void;
}) {
  const steps = [
    {
      done: true,
      label: "أنشئ المتجر واختر رابطه",
      action: null,
    },
    {
      done: published > 0,
      label: "اختر الأصناف المعروضة وأضف صورها",
      action: () => onGo("products"),
    },
    {
      done: store.isPublished,
      label: "انشر المتجر ليراه العملاء",
      action: () => onGo("settings"),
    },
  ];
  if (steps.every((s) => s.done)) return null;
  return (
    <section className="space-y-2 border border-primary/40 bg-primary/5 p-4">
      <h2 className="text-sm font-semibold">خطوات تجهيز المتجر</h2>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            {s.done ? (
              <IconCircleCheck className="size-4 text-success" />
            ) : (
              <IconCircleDashed className="size-4 text-muted-foreground" />
            )}
            <span
              className={cn(s.done && "text-muted-foreground line-through")}
            >
              {s.label}
            </span>
            {!s.done && s.action && (
              <Button
                size="xs"
                variant="outline"
                className="ms-auto"
                onClick={s.action}
              >
                ابدأ
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function StoreOverview({
  store,
  onGo,
  onOpenOrder,
}: {
  store: StoreSettings;
  onGo: (t: StoreTab) => void;
  onOpenOrder: (id: string) => void;
}) {
  const { data: s, isPending } = useStoreSummary();

  if (isPending || !s)
    return (
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );

  const trend = s.daily.map((d) => {
    const ts = parseIsoDay(d.day);
    return {
      key: d.day,
      label: formatShortDate(ts),
      title: formatShortDate(ts),
      current: d.sales,
    };
  });
  const pendingCount = s.counts.new;

  return (
    <div className="flex flex-col gap-4">
      <Checklist store={store} published={s.publishedProducts} onGo={onGo} />

      {!store.acceptingOrders && store.isPublished && (
        <p className="flex items-center gap-2 border border-warning/40 bg-warning/5 p-3 text-sm text-warning">
          <IconAlertTriangle className="size-4 shrink-0" />
          استقبال الطلبات متوقف: العملاء يتصفحون المتجر لكن لا يقدرون على الطلب.
          <Button
            size="xs"
            variant="outline"
            className="ms-auto"
            onClick={() => onGo("settings")}
          >
            الإعدادات
          </Button>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          index={0}
          icon={<IconShoppingBag />}
          label="طلبات جديدة"
          tone={pendingCount ? "danger" : "default"}
          hint={pendingCount ? "بانتظار تأكيدك" : "لا شيء بانتظارك"}
          onClick={() => onGo("orders")}
        >
          {pendingCount}
        </StatTile>
        <StatTile
          index={1}
          icon={<IconTruckDelivery />}
          label="قيد التجهيز والتوصيل"
          tone="warning"
          onClick={() => onGo("orders")}
        >
          {s.counts.confirmed + s.counts.delivering}
        </StatTile>
        <StatTile
          index={2}
          icon={<IconCash />}
          label="مبيعات اليوم"
          hint={`${s.todayOrders} طلب`}
        >
          <Money amount={s.todaySales} />
        </StatTile>
        <StatTile
          index={3}
          icon={<IconReceipt />}
          label="متوسط الطلب (7 أيام)"
          hint={`${s.weekOrders} طلب`}
        >
          <Money amount={s.averageOrder} />
        </StatTile>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title="مبيعات المتجر آخر 7 أيام"
          subtitle={
            <>
              الإجمالي <Money amount={s.weekSales} className="text-[11px]" />{" "}
              بدون الطلبات الملغاة
            </>
          }
          className="lg:col-span-2"
        >
          {s.weekOrders === 0 ? (
            <ChartEmpty text="لا طلبات خلال آخر 7 أيام" height={220} />
          ) : (
            <TrendChart data={trend} currentLabel="المبيعات" height={220} />
          )}
        </ChartCard>
        <ChartCard title="الأكثر طلباً" subtitle="آخر 30 يوماً">
          {s.topProducts.length === 0 ? (
            <ChartEmpty text="لا بيانات بعد" height={220} />
          ) : (
            <RankBarChart
              items={s.topProducts.map((p) => ({
                key: p.gid,
                label: p.name,
                value: p.sales,
              }))}
              valueLabel="المبيعات"
              labelWidth={110}
            />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="border bg-card lg:col-span-2">
          <header className="flex items-center justify-between border-b p-3">
            <h2 className="text-sm font-semibold">أحدث الطلبات</h2>
            <Button size="xs" variant="ghost" onClick={() => onGo("orders")}>
              كل الطلبات
            </Button>
          </header>
          {s.recent.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              لم تصل طلبات بعد. شارك رابط متجرك مع عملائك على واتساب وفيسبوك.
            </p>
          ) : (
            <ul className="divide-y">
              {s.recent.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onOpenOrder(o.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="w-12 font-mono text-xs font-semibold">
                      #{o.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {o.customerName}
                    </span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {formatWhen(o.createdAt)}
                    </span>
                    <StatusBadge status={o.status} />
                    <Money amount={o.total} className="w-28 justify-end" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-3 border bg-card p-3">
          <h2 className="text-sm font-semibold">المعروض في المتجر</h2>
          <p className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold">
              {s.publishedProducts}
            </span>
            <span className="text-sm text-muted-foreground">صنف</span>
          </p>
          {s.outOfStock > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <IconPackageOff className="size-4" />
              {s.outOfStock} صنف نفد ولا يقدر العملاء على طلبه
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            المُسلَّم خلال 30 يوماً{" "}
            <Money amount={s.monthDelivered} className="text-xs" />
          </p>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => onGo("products")}
          >
            إدارة الأصناف
          </Button>
        </section>
      </div>
    </div>
  );
}
