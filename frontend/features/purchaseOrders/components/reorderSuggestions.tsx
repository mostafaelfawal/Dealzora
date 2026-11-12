"use client";

import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClockExclamation,
  IconFileInvoice,
  IconLoader2,
  IconPackageOff,
  IconTrendingDown,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Money } from "@/components/shared/Money";
import { StatTile } from "@/components/shared/StatTile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePurchaseSuppliers } from "@/features/purchases/hooks/usePurchases";

import { NO_SUPPLIER } from "../config/purchaseOrderOptions";
import { useCreateOrders, useSuggestions } from "../hooks/usePurchaseOrders";
import {
  canOrder,
  filterByUrgency,
  groupBySupplier,
  mergeDrafts,
  toOrderInput,
  type Drafts,
} from "../lib/suggestionDraft";
import type {
  ReorderSettings,
  SuggestionDraft,
  Urgency,
} from "../types/purchaseOrder";
import { ReorderSettingsBar } from "./reorderSettingsBar";
import { SupplierGroupCard } from "./supplierGroupCard";

/** النواقص المتوقعة مجمّعة حسب المورد، وإنشاء طلب لكل مورد بضغطة. */
export function ReorderSuggestions({
  settings,
  onSettingsChange: update,
}: {
  settings: ReorderSettings;
  onSettingsChange: (patch: Partial<ReorderSettings>) => void;
}) {
  const query = useSuggestions(settings);
  const suppliersQuery = usePurchaseSuppliers();
  const create = useCreateOrders();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [urgency, setUrgency] = useState<Urgency | "all">("all");
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const settingsKey = JSON.stringify(settings);
  const lastSettings = useRef(settingsKey);

  const data = query.data;
  useEffect(() => {
    if (!data || query.isPlaceholderData) return;
    // الإعدادات تغيّرت ← اقتراح جديد بالكامل. تحديث لحظي ← نحتفظ بما عدّله المستخدم.
    const reset = lastSettings.current !== settingsKey;
    lastSettings.current = settingsKey;
    setDrafts((prev) => mergeDrafts(data.items, prev, reset));
  }, [data, query.isPlaceholderData, settingsKey]);

  const supplierOptions = useMemo(
    () => [
      { value: NO_SUPPLIER, label: "بدون مورد" },
      ...(suppliersQuery.data ?? [])
        .filter((s) => s.isActive)
        .map((s) => ({ value: s.id, label: s.name })),
    ],
    [suppliersQuery.data],
  );
  const supplierNames = useMemo(
    () => new Map((suppliersQuery.data ?? []).map((s) => [s.id, s.name])),
    [suppliersQuery.data],
  );

  const visible = useMemo(
    () =>
      filterByUrgency(data?.items ?? [], urgency).filter(
        (s) => drafts[s.productId],
      ),
    [data, urgency, drafts],
  );
  const groups = useMemo(
    () => groupBySupplier(visible, drafts, supplierNames),
    [visible, drafts, supplierNames],
  );
  const ready = groups.filter(canOrder);

  function patch(productId: string, p: Partial<SuggestionDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], ...p },
    }));
  }

  function toggleGroup(ids: string[], selected: boolean) {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        const d = next[id];
        next[id] = { ...d, selected, qty: selected && !d.qty ? "1" : d.qty };
      }
      return next;
    });
  }

  function createFor(ids: string[]) {
    const targets = ready.filter((g) => ids.includes(g.supplierId));
    if (!targets.length) return;
    setCreatingId(ids.length === 1 ? ids[0] : "*");
    const inputs = targets.map((g) => toOrderInput(g, drafts));
    create.mutate(inputs, {
      onSuccess: ({ created }) => {
        // الأصناف التي طُلبت تُبنى من جديد مع الاقتراح المحدَّث (الكمية في الطريق تُخصم)،
        // فلا يبقى اختيارها القديم ويُطلب مرتين.
        const done = new Set(created.map((o) => o.supplierId));
        const ordered = inputs
          .filter((i) => done.has(i.supplierId))
          .flatMap((i) => i.lines.map((l) => l.productId));
        setDrafts((prev) => {
          const next = { ...prev };
          for (const id of ordered) delete next[id];
          return next;
        });
      },
      onSettled: () => setCreatingId(null),
    });
  }

  const totals = data?.totals;
  const tile = (u: Urgency) => ({
    active: urgency === u,
    onClick: () => setUrgency(urgency === u ? "all" : u),
  });

  return (
    <div className="flex flex-col gap-4">
      <ReorderSettingsBar settings={settings} onChange={update} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <StatTile
          index={0}
          icon={<IconPackageOff />}
          label="نفد"
          tone="danger"
          {...tile("out")}
        >
          {totals?.out ?? 0}
        </StatTile>
        <StatTile
          index={1}
          icon={<IconClockExclamation />}
          label="سينفد قبل التوريد"
          tone="warning"
          {...tile("critical")}
        >
          {totals?.critical ?? 0}
        </StatTile>
        <StatTile
          index={2}
          icon={<IconTrendingDown />}
          label="تحت الحد الأدنى"
          {...tile("low")}
        >
          {totals?.low ?? 0}
        </StatTile>
        <StatTile
          index={3}
          icon={<IconAlertTriangle />}
          label="يحتاج طلباً قريباً"
          {...tile("soon")}
        >
          {totals?.soon ?? 0}
        </StatTile>
        <StatTile
          index={4}
          icon={<IconFileInvoice />}
          label="تكلفة الطلب المقترح"
          hint={totals ? `${totals.suppliers} مورد` : undefined}
        >
          <Money amount={totals?.estimatedTotal ?? 0} className="text-lg" />
        </StatTile>
      </div>

      {ready.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm">
            جاهز {ready.length} طلبات لـ {ready.length} موردين بإجمالي{" "}
            <Money
              amount={ready.reduce((sum, g) => sum + g.total, 0)}
              className="inline-flex text-sm"
            />
          </p>
          <Button
            onClick={() => createFor(ready.map((g) => g.supplierId))}
            disabled={create.isPending}
            className="gap-2"
          >
            {creatingId === "*" ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconFileInvoice className="size-4" />
            )}
            إنشاء كل الطلبات
          </Button>
        </div>
      )}

      {query.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border bg-card p-10 text-center">
          <IconCircleCheck className="size-10 text-success" />
          <p className="font-medium">
            {urgency === "all" ? "لا نواقص الآن" : "لا أصناف في هذا التصنيف"}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            الأصناف تظهر هنا تلقائياً عندما يقترب رصيدها من النفاد حسب سرعة بيعها
            الفعلية أو تنزل تحت الحد الأدنى.
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <SupplierGroupCard
            key={g.supplierId || "none"}
            group={g}
            drafts={drafts}
            suppliers={supplierOptions}
            onPatch={patch}
            onToggleAll={(v) =>
              toggleGroup(
                g.items.map((s) => s.productId),
                v,
              )
            }
            onCreate={() => createFor([g.supplierId])}
            creating={creatingId === g.supplierId}
          />
        ))
      )}
    </div>
  );
}
