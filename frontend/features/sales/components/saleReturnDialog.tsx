"use client";

import {
  IconLoader2,
  IconMinus,
  IconPlus,
  IconPrinter,
  IconReceiptRefund,
} from "@tabler/icons-react";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useShopName } from "@/features/settings/hooks/useSettings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";

import { RETURN_REASONS } from "../config/saleOptions";
import { useCreateReturn } from "../hooks/useSales";
import {
  clampReturnQty,
  returnableQty,
  saleReturnSelection,
  type SaleReturnQtys,
} from "../lib/saleReturn";
import { printReturnReceipt } from "../lib/receipt";
import type { RefundVia, ReturnReason, Sale, SaleLine } from "../types/sale";
import { AppTooltip } from "@/components/shared/AppTooltip";

const NOTE_MAX = 200;
const DEFAULT_SHOP_NAME = "Dealzora";

/** سطر بكمية قابلة للزيادة والنقص، و"الكل" لإرجاع المتاح كله. */
function ReturnLineStepper({
  line,
  qty,
  onChange,
}: {
  line: SaleLine;
  qty: number;
  onChange: (qty: number) => void;
}) {
  const max = returnableQty(line);
  const set = (value: number) => onChange(clampReturnQty(value, max));

  return (
    <li
      className={cn("flex items-center gap-3 p-2.5", max === 0 && "opacity-50")}
    >
      <span className="min-w-0 flex-1">
        <AppTooltip message={line.name} onlyWhenTruncated>
          <span className="block truncate text-sm font-medium">
            {line.name}
          </span>
        </AppTooltip>
        <span className="text-[11px] text-muted-foreground">
          مباع {formatQty(line.qty)} {line.unitName}
          {line.returnedQty > 0 && ` · رجع ${formatQty(line.returnedQty)}`}
        </span>
      </span>
      <div className="flex items-center">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`تقليل ${line.name}`}
          disabled={qty <= 0}
          onClick={() => set(qty - 1)}
          className="size-8"
        >
          <IconMinus />
        </Button>
        <Input
          aria-label={`كمية مرتجع ${line.name}`}
          dir="ltr"
          inputMode="decimal"
          disabled={max === 0}
          value={qty === 0 ? "" : String(qty)}
          placeholder="0"
          onChange={(e) => set(Number(e.target.value) || 0)}
          className="h-8 w-14 border-x-0 text-center font-mono"
        />
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`زيادة ${line.name}`}
          disabled={qty >= max}
          onClick={() => set(qty + 1)}
          className="size-8"
        >
          <IconPlus />
        </Button>
      </div>
      <Button
        type="button"
        size="xs"
        variant="link"
        disabled={max === 0 || qty === max}
        onClick={() => set(max)}
        className="font-normal"
      >
        الكل
      </Button>
    </li>
  );
}

function ReturnForm({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const create = useCreateReturn();
  const shopName = useShopName().data ?? DEFAULT_SHOP_NAME;
  const [print, setPrint] = useState(true);
  const [qtys, setQtys] = useState<SaleReturnQtys>({});
  const [reason, setReason] = useState<ReturnReason>("customer_changed");
  const [note, setNote] = useState("");
  const paidByWallet = sale.walletAmount > 0;
  // فاتورة على عميل مسجّل: يمكن رد المبلغ لرصيده لدى المحل (استبدال لاحقاً بدل الكاش).
  const hasCustomer = Boolean(sale.customerId);
  const [refundVia, setRefundVia] = useState<RefundVia>(
    paidByWallet ? "wallet" : "cash",
  );
  const refundItems = [
    ...(paidByWallet
      ? [{ id: "wallet" as const, label: `تحويل على ${sale.paymentLabel}` }]
      : []),
    { id: "cash" as const, label: "نقداً من الدرج" },
    ...(hasCustomer
      ? [{ id: "balance" as const, label: "رصيد للعميل لدى المحل" }]
      : []),
  ];
  const selection = saleReturnSelection(sale, qtys);
  const canSubmit = selection.chosen.length > 0 && !create.isPending;

  function submit() {
    if (!canSubmit) return;
    create.mutate(
      {
        saleId: sale.id,
        input: {
          reason,
          note: note.trim(),
          lines: selection.lines,
          ...(paidByWallet || hasCustomer ? { refundVia } : {}),
        },
      },
      {
        onSuccess: (ret) => {
          if (print)
            void printReturnReceipt(ret, shopName, { openDrawer: true });
          onClose();
        },
      },
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-3"
    >
      <DialogHeader className="text-start">
        <DialogTitle>مرتجع من فاتورة #{sale.number}</DialogTitle>
        <DialogDescription>
          {sale.customerName ?? "عميل نقدي"} · تعود الأصناف إلى المخزون، والمبلغ
          يُخصم من دين العميل أولاً (إن كانت الفاتورة آجلة) ثم يُرد نقداً من الخزنة.
        </DialogDescription>
      </DialogHeader>

      <ul className="divide-y border">
        {sale.lines.map((line) => (
          <ReturnLineStepper
            key={line.id}
            line={line}
            qty={qtys[line.id] ?? 0}
            onChange={(qty) => setQtys((prev) => ({ ...prev, [line.id]: qty }))}
          />
        ))}
      </ul>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">سبب المرتجع</span>
        <SegmentedTabs
          label="سبب المرتجع"
          items={RETURN_REASONS}
          value={reason}
          onChange={setReason}
        />
      </div>
      {refundItems.length > 1 && (
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">
            {paidByWallet
              ? `رد المبلغ (الفاتورة مدفوعة ${sale.paymentLabel})`
              : "رد المبلغ"}
          </span>
          <SegmentedTabs
            label="طريقة رد المبلغ"
            items={refundItems}
            value={refundVia}
            onChange={setRefundVia}
          />
          {refundVia === "balance" && (
            <p className="text-[11px] text-muted-foreground">
              لا يخرج شيء من الدرج: يُضاف المبلغ لرصيد {sale.customerName}{" "}
              ويستخدمه في أي فاتورة قادمة.
            </p>
          )}
        </div>
      )}
      <Input
        aria-label="ملاحظة"
        value={note}
        maxLength={NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة (اختياري)"
      />

      <div className="flex items-end justify-between border-t pt-3">
        <span className="pb-0.5 text-sm font-medium">
          قيمة المرتجع (تقريباً)
        </span>
        <Money amount={selection.estimate} className="text-2xl leading-none" />
      </div>

      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={print}
          onCheckedChange={(value) => setPrint(Boolean(value))}
        />
        طباعة إيصال المرتجع
        <IconPrinter className="size-5" />
      </label>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onClose}
          className="gap-2 font-normal"
        >
          رجوع
          <ShortcutBadge className="hidden rounded-none lg:inline-flex">
            Esc
          </ShortcutBadge>
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          className="gap-2 px-5"
        >
          {create.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconReceiptRefund className="size-4" />
          )}
          تسجيل المرتجع
        </Button>
      </div>
    </form>
  );
}

/** مرتجع من لوحة المدير (بدون مهلة). القيمة النهائية يحسبها السيرفر بالسعر المدفوع فعلاً. */
export function SaleReturnDialog({
  sale,
  onClose,
}: {
  sale: Sale | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={sale !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-lg"
      >
        {/* key يعيد تهيئة النموذج لكل فاتورة. */}
        {sale && <ReturnForm key={sale.id} sale={sale} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
