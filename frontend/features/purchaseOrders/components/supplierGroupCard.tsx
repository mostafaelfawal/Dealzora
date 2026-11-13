"use client";

import { IconFileInvoice, IconLoader2, IconTruck } from "@tabler/icons-react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { NO_SUPPLIER, URGENCY_INFO } from "../config/purchaseOrderOptions";
import {
  canOrder,
  daysLeftLabel,
  draftQty,
  lineValue,
  packHint,
  qtyError,
  type Drafts,
  type SupplierGroup,
} from "../lib/suggestionDraft";
import type { Suggestion, SuggestionDraft } from "../types/purchaseOrder";

export interface SupplierOption {
  value: string;
  label: string;
}

function UrgencyBadge({ s }: { s: Suggestion }) {
  const info = URGENCY_INFO[s.urgency];
  return (
    <AppTooltip message={info.hint}>
      <span
        className={cn("inline-flex px-1.5 py-0.5 text-[11px]", info.className)}
      >
        {info.label}
      </span>
    </AppTooltip>
  );
}

function SuggestionRow({
  s,
  d,
  suppliers,
  onPatch,
}: {
  s: Suggestion;
  d: SuggestionDraft;
  suppliers: SupplierOption[];
  onPatch: (patch: Partial<SuggestionDraft>) => void;
}) {
  const error = qtyError(s, d);
  const hint = packHint(s, draftQty(d));
  return (
    <tr className={cn("border-t align-top", !d.selected && "opacity-60")}>
      <td className="p-2">
        <Checkbox
          checked={d.selected}
          onCheckedChange={(v) =>
            onPatch({
              selected: v,
              qty: v && !d.qty ? String(s.suggestedQty || 1) : d.qty,
            })
          }
          aria-label={`اختيار ${s.name}`}
        />
      </td>
      <td className="min-w-44 p-2">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{s.name}</span>
          <UrgencyBadge s={s} />
        </div>
        <div className="text-[11px] text-muted-foreground">
          {daysLeftLabel(s)}
          {s.avgDaily > 0 && (
            <>
              {" · "}يُباع <Num>{formatQty(s.avgDaily)}</Num>/يوم
            </>
          )}
          {s.onOrder > 0 && (
            <>
              {" · "}في الطريق <Num>{formatQty(s.onOrder)}</Num>
            </>
          )}
        </div>
      </td>
      <td className="p-2 text-xs whitespace-nowrap">
        <Num className={s.stock <= 0 ? "text-destructive" : ""}>
          {formatQty(s.stock)}
        </Num>
        <span className="text-muted-foreground">
          {" / "}
          <Num>{formatQty(s.minStock)}</Num> {s.unit}
        </span>
      </td>
      <td className="w-32 p-2">
        <Input
          value={d.qty}
          inputMode="decimal"
          dir="ltr"
          disabled={!d.selected}
          aria-invalid={Boolean(error)}
          aria-label={`كمية ${s.name}`}
          onChange={(e) => onPatch({ qty: e.target.value })}
          className="h-8 font-mono"
        />
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : s.suggestedQty === 0 ? (
            "مغطى بطلب مفتوح"
          ) : (
            (hint ?? `مقترح ${formatQty(s.suggestedQty)}`)
          )}
        </div>
      </td>
      <td className="p-2 text-end whitespace-nowrap">
        <Money amount={lineValue(s, d)} className="text-sm" />
        <div className="text-[11px] text-muted-foreground">
          × <Num>{formatQty(s.unitCost)}</Num>
        </div>
      </td>
      <td className="w-40 p-2">
        <OptionSelect
          label={`مورد ${s.name}`}
          items={suppliers}
          value={d.supplierId}
          onChange={(v) => onPatch({ supplierId: v })}
          className="h-8 w-full text-xs data-[size=default]:h-8"
        />
      </td>
    </tr>
  );
}

/** أصناف مورد واحد: مراجعة الكميات ثم «إنشاء طلب». */
export function SupplierGroupCard({
  group,
  drafts,
  suppliers,
  onPatch,
  onToggleAll,
  onCreate,
  creating,
}: {
  group: SupplierGroup;
  drafts: Drafts;
  suppliers: SupplierOption[];
  onPatch: (productId: string, patch: Partial<SuggestionDraft>) => void;
  onToggleAll: (selected: boolean) => void;
  onCreate: () => void;
  creating: boolean;
}) {
  const noSupplier = group.supplierId === NO_SUPPLIER;
  const allSelected = group.selected === group.items.length;

  return (
    <section className="border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b p-3">
        <span className="flex size-9 shrink-0 items-center justify-center bg-muted text-muted-foreground">
          <IconTruck className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{group.supplierName}</h3>
          <p className="text-xs text-muted-foreground">
            {noSupplier
              ? "لم تُشترَ من قبل: اختر مورداً لكل صنف لينتقل لمجموعته"
              : `${group.selected} من ${group.items.length} صنف مختار`}
          </p>
        </div>
        {!noSupplier && (
          <>
            <Money amount={group.total} className="text-base" />
            <Button
              onClick={onCreate}
              disabled={!canOrder(group) || creating}
              className="gap-2"
            >
              {creating ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconFileInvoice className="size-4" />
              )}
              إنشاء طلب
            </Button>
          </>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="w-8 p-2 text-start">
                <Checkbox
                  checked={allSelected}
                  indeterminate={group.selected > 0 && !allSelected}
                  onCheckedChange={(v) => onToggleAll(v)}
                  aria-label="اختيار الكل"
                />
              </th>
              <th className="p-2 text-start font-normal">الصنف</th>
              <th className="p-2 text-start font-normal">الرصيد / الحد</th>
              <th className="p-2 text-start font-normal">الكمية</th>
              <th className="p-2 text-end font-normal">القيمة التقديرية</th>
              <th className="p-2 text-start font-normal">المورد</th>
            </tr>
          </thead>
          <tbody>
            {group.items.map((s) => (
              <SuggestionRow
                key={s.productId}
                s={s}
                d={drafts[s.productId]}
                suppliers={suppliers}
                onPatch={(patch) => onPatch(s.productId, patch)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
