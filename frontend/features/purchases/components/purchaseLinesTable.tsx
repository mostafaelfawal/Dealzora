"use client";

import { IconTrash, IconTruckDelivery } from "@tabler/icons-react";

import { Money } from "@/components/shared/Money";
import { listItem, MotionTr } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { lineValue } from "../lib/purchaseDraft";
import type { PurchaseDraftLine } from "../types/purchase";

const COLUMNS = [
  { label: "الصنف", className: "px-3" },
  { label: "الكمية", className: "w-28 px-2" },
  { label: "سعر الشراء", className: "w-32 px-2" },
  { label: "سعر بيع جديد", className: "w-32 px-2" },
  { label: "الإجمالي", className: "w-32 px-2" },
];

const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) =>
  e.currentTarget.select();

function NumberCell({
  label,
  value,
  placeholder,
  selectAll,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  selectAll?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <td className="px-2">
      <Input
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={selectAll ? selectOnFocus : undefined}
        dir="ltr"
        inputMode="decimal"
        className="h-9 font-mono"
      />
    </td>
  );
}

function LineRow({
  line: l,
  index,
  invalid,
  onPatch,
  onRemove,
}: {
  line: PurchaseDraftLine;
  index: number;
  invalid: boolean;
  onPatch: (patch: Partial<PurchaseDraftLine>) => void;
  onRemove: () => void;
}) {
  return (
    <MotionTr
      {...listItem(index)}
      className={cn("h-14 border-t", invalid && "bg-destructive/5")}
    >
      <td className="px-3">
        <p className="truncate font-medium">{l.name}</p>
        <p className="text-[11px] text-muted-foreground">
          الشراء الحالي <Money amount={l.currentCost} className="text-[11px]" />{" "}
          · البيع <Money amount={l.currentPrice} className="text-[11px]" /> /{" "}
          {l.unit}
        </p>
      </td>
      <NumberCell
        label={`كمية ${l.name}`}
        value={l.qty}
        selectAll
        onChange={(qty) => onPatch({ qty })}
      />
      <NumberCell
        label={`سعر شراء ${l.name}`}
        value={l.cost}
        selectAll
        onChange={(cost) => onPatch({ cost })}
      />
      <NumberCell
        label={`سعر بيع جديد ${l.name}`}
        value={l.salePrice}
        placeholder={String(l.currentPrice)}
        onChange={(salePrice) => onPatch({ salePrice })}
      />
      <td className="px-2">
        <Money amount={lineValue(l)} className="text-sm" />
      </td>
      <td className="pe-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`حذف ${l.name}`}
          onClick={onRemove}
        >
          <IconTrash className="text-destructive" />
        </Button>
      </td>
    </MotionTr>
  );
}

/** أصناف الفاتورة. السطر الخاطئ يُظلَّل بعد أول محاولة حفظ فقط. */
export function PurchaseLinesTable({
  lines,
  lineErrors,
  showErrors,
  onPatch,
  onRemove,
}: {
  lines: PurchaseDraftLine[];
  lineErrors: (string | null)[];
  showErrors: boolean;
  onPatch: (key: string, patch: Partial<PurchaseDraftLine>) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto border">
      <table className="w-full min-w-[720px] text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr className="h-9 text-start">
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                className={cn("text-start font-normal", col.className)}
              >
                {col.label}
              </th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td
                colSpan={COLUMNS.length + 1}
                className="py-14 text-center text-muted-foreground"
              >
                <IconTruckDelivery className="mx-auto mb-2 size-8" />
                ابدأ بمسح باركود أول صنف في فاتورة المورد
              </td>
            </tr>
          ) : (
            lines.map((line, i) => (
              <LineRow
                key={line.key}
                line={line}
                index={i}
                invalid={showErrors && Boolean(lineErrors[i])}
                onPatch={(patch) => onPatch(line.key, patch)}
                onRemove={() => onRemove(line.key)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
