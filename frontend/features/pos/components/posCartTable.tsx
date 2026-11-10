"use client";

import {
  IconAlertTriangle,
  IconBarcode,
  IconCheck,
  IconChevronDown,
  IconX,
} from "@tabler/icons-react";
import { useEffect } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatQty } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cn } from "cn";
import { lineDiscount, lineKey, lineTotal, unitOptions } from "../lib/posCalc";
import { cartActions } from "../store/cartSlice";
import { changeLineUnit, removeLineWithUndo } from "../store/posActions";
import {
  selectLines,
  selectProducts,
  selectSelectedId,
} from "../store/selectors";
import type { CartLine } from "../types/pos";

import { PosQtyField } from "./posQtyField";

const th = "h-8 px-2 text-start text-xs font-normal text-muted-foreground";

/**
 * مبدّل وحدة البيع (قطعة <-> كرتونة) لصنف له وحدات إضافية.
 * بدون وحدات إضافية: يعرض اسم الوحدة كنص فقط.
 */
function UnitSwitcher({ line, id }: { line: CartLine; id: string }) {
  const dispatch = useAppDispatch();
  const product = useAppSelector((s) =>
    selectProducts(s).find((p) => p.id === line.productId),
  );
  const options = product ? unitOptions(product) : [];
  const current = line.unitId ?? null;

  if (options.length < 2) {
    return (
      <span className="text-[11px] text-muted-foreground">{line.unit}</span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`وحدة البيع: ${line.unit}. اضغط للتغيير`}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "inline-flex h-6 items-center gap-0.5 rounded-sm border px-1.5 text-[11px]",
              "outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/40",
              current
                ? "border-primary/50 bg-primary/10 font-medium text-primary"
                : "",
            )}
          />
        }
      >
        {line.unit}
        <IconChevronDown className="size-3" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs">وحدة البيع</DropdownMenuLabel>
          {options.map((u) => (
            <DropdownMenuItem
              key={u.id ?? "base"}
              onClick={() => dispatch(changeLineUnit(id, u.id))}
              className="justify-between gap-3"
            >
              <span className="flex items-center gap-1.5">
                {u.id === current ? (
                  <IconCheck className="size-3.5" />
                ) : (
                  <span className="size-3.5" />
                )}
                {u.name}
                {u.factor !== 1 && (
                  <span className="text-[10px] text-muted-foreground">
                    ({formatQty(u.factor)} {product?.unit})
                  </span>
                )}
              </span>
              <Money amount={u.price} className="text-xs" />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CartRow({
  line,
  index,
  selected,
}: {
  line: CartLine;
  index: number;
  selected: boolean;
}) {
  const dispatch = useAppDispatch();
  const id = lineKey(line);
  const factor = line.factor ?? 1;
  // المخزون بالوحدة الأساسية، والسطر بوحدة البيع (الكرتونة = 12 قطعة).
  const overStock = line.qty * factor > line.stock;
  const available = factor === 1 ? line.stock : Math.floor(line.stock / factor);

  return (
    <tr
      id={`pos-line-${id}`}
      aria-selected={selected}
      onClick={() => dispatch(cartActions.selectLine(id))}
      className={cn(
        "h-14 scroll-mt-8 cursor-pointer border-b lg:h-12",
        selected && "bg-muted",
      )}
    >
      <td className="hidden px-2 font-mono text-muted-foreground tabular-nums sm:table-cell">
        {index + 1}
      </td>
      <td className="relative px-2">
        {selected && (
          <span
            aria-hidden
            className="absolute inset-y-0 inset-s-0 w-0.5 bg-primary"
          />
        )}
        <span className="block truncate text-xs font-medium">{line.name}</span>
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <UnitSwitcher line={line} id={id} />
          <span className="hidden font-mono sm:flex sm:gap-1">
            <IconBarcode className="size-4" />
            {line.barcode}
          </span>
          <span className="sm:hidden">
            <Money amount={line.price} className="text-[11px]" />
          </span>
          {overStock && (
            <span className="inline-flex items-center gap-1 text-warning">
              <IconAlertTriangle className="size-3" />
              أكثر من المتاح ({formatQty(available)})
            </span>
          )}
        </span>
      </td>
      <td className="hidden px-2 sm:table-cell">
        <Money amount={line.price} className="text-xs" />
      </td>
      <td className="px-2">
        <PosQtyField line={line} />
      </td>
      <td className="px-2">
        <Money amount={lineTotal(line)} className="text-sm" />
        {lineDiscount(line) > 0 && (
          <span className="block text-[10px] text-warning">
            خصم <Money amount={lineDiscount(line)} className="text-[10px]" />
          </span>
        )}
      </td>
      <td className="pe-1">
        <AppTooltip message={`حذف ${line.name}`}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`حذف ${line.name}`}
            onClick={(event) => {
              event.stopPropagation();
              dispatch(removeLineWithUndo(id));
            }}
            className="size-9 lg:size-7"
          >
            <IconX />
          </Button>
        </AppTooltip>
      </td>
    </tr>
  );
}

/**
 * جدول الفاتورة.
 * عمداً <table> عادي وليس shadcn Table: لأن حاوية Table تكسر الترويسة الثابتة (sticky header).
 */
export function PosCartTable() {
  const lines = useAppSelector(selectLines);
  const selectedId = useAppSelector(selectSelectedId);

  useEffect(() => {
    if (!selectedId) return;
    document
      .getElementById(`pos-line-${selectedId}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId, lines.length]);

  if (lines.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
        <IconBarcode className="size-10" />
        <p className="text-sm font-medium text-foreground">الفاتورة فارغة</p>
        <p>امسح باركود أو اكتب اسم صنف، أو اضغط على بطاقة صنف.</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b">
            <th scope="col" className={cn(th, "hidden w-8 sm:table-cell")}>
              #
            </th>
            <th scope="col" className={th}>
              الصنف
            </th>
            <th scope="col" className={cn(th, "hidden w-20 sm:table-cell")}>
              السعر
            </th>
            <th scope="col" className={cn(th, "w-36")}>
              الكمية
            </th>
            <th scope="col" className={cn(th, "w-24")}>
              الإجمالي
            </th>
            <th scope="col" className="w-10">
              <span className="sr-only">حذف</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <CartRow
              key={lineKey(line)}
              line={line}
              index={index}
              selected={lineKey(line) === selectedId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
