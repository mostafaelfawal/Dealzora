"use client";

import {
  IconBrandWhatsapp,
  IconDeviceFloppy,
  IconPackageImport,
  IconPrinter,
  IconSend,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { round2 } from "@/features/pos/lib/posCalc";
import { useShopName } from "@/features/settings/hooks/useSettings";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatQty, parseNumberInput } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  PURCHASE_ORDER_ROUTES,
  STATUS_INFO,
} from "../config/purchaseOrderOptions";
import {
  useCancelOrder,
  useMarkSent,
  useOrder,
  useUpdateOrder,
} from "../hooks/usePurchaseOrders";
import { printOrder, sendOrderWhatsapp } from "../lib/orderDocument";
import type { PurchaseOrder } from "../types/purchaseOrder";

const DEFAULT_SHOP_NAME = "Dealzora";

/** كميات معدّلة: id السطر ← النص (المحذوف = null). */
type Edits = Record<string, string | null>;

function OrderBody({ o }: { o: PurchaseOrder }) {
  const shopName = useShopName().data ?? DEFAULT_SHOP_NAME;
  const update = useUpdateOrder();
  const markSent = useMarkSent();
  const cancel = useCancelOrder();
  const [edits, setEdits] = useState<Edits>({});
  const [confirmCancel, setConfirmCancel] = useState(false);
  const open = o.status === "draft" || o.status === "sent";
  const dirty = Object.keys(edits).length > 0;

  const lines = o.lines
    .filter((l) => edits[l.id] !== null)
    .map((l) => {
      const text = edits[l.id] ?? String(l.qty);
      const qty = parseNumberInput(text);
      return { ...l, text, qty, valid: qty > 0 };
    });
  const total = round2(
    lines.reduce((s, l) => s + (l.valid ? l.qty * l.unitCost : 0), 0),
  );
  const canSave = dirty && lines.length > 0 && lines.every((l) => l.valid);

  const save = () =>
    update.mutate(
      {
        order: o,
        input: {
          supplierId: o.supplierId,
          note: o.note,
          lines: lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
            unitCost: l.unitCost,
          })),
        },
      },
      { onSuccess: () => setEdits({}) },
    );

  async function whatsapp() {
    if (dirty) return toast.info("احفظ التعديلات أولاً");
    try {
      const opened = await sendOrderWhatsapp(o, shopName);
      if (opened && o.status === "draft") markSent.mutate(o);
    } catch {
      toast.error("تعذّر فتح واتساب");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <ul className="divide-y border">
        {lines.map((l) => {
          const low = l.currentStock !== null && l.currentStock <= 0;
          return (
            <li key={l.id} className="flex items-start gap-2 p-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {l.name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  الرصيد وقت الطلب <Num>{formatQty(l.stockAtOrder)}</Num>
                  {l.currentStock !== null && (
                    <>
                      {" · الآن "}
                      <Num className={cn(low && "text-destructive")}>
                        {formatQty(l.currentStock)}
                      </Num>
                    </>
                  )}
                  {" · "}× <Num>{formatQty(l.unitCost)}</Num>
                </span>
              </span>
              {open ? (
                <>
                  <Input
                    value={l.text}
                    inputMode="decimal"
                    dir="ltr"
                    aria-label={`كمية ${l.name}`}
                    aria-invalid={!l.valid}
                    onChange={(e) =>
                      setEdits((p) => ({ ...p, [l.id]: e.target.value }))
                    }
                    className="h-8 w-20 font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`حذف ${l.name}`}
                    onClick={() => setEdits((p) => ({ ...p, [l.id]: null }))}
                  >
                    <IconX className="size-4" />
                  </Button>
                </>
              ) : (
                <span className="text-sm">
                  <Num>{formatQty(l.qty)}</Num> {l.unitName}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-sm font-medium">الإجمالي التقديري</dt>
          <dd>
            <Money amount={dirty ? total : o.total} className="text-xl" />
          </dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>أنشأه</dt>
          <dd>
            {o.createdByName ?? "—"} · {formatDateTime(o.createdAt)}
          </dd>
        </div>
        {o.sentAt && (
          <div className="flex justify-between text-muted-foreground">
            <dt>أُرسل للمورد</dt>
            <dd>{formatDateTime(o.sentAt)}</dd>
          </div>
        )}
        {o.purchaseNumber && (
          <div className="flex justify-between text-success">
            <dt>استُلم بفاتورة شراء</dt>
            <dd>#{o.purchaseNumber}</dd>
          </div>
        )}
        {o.note && (
          <p className="pt-1 text-muted-foreground">ملاحظة: {o.note}</p>
        )}
      </dl>

      <div className="mt-auto grid grid-cols-2 gap-2">
        {dirty && (
          <Button
            size="lg"
            className="col-span-2 gap-2"
            disabled={!canSave || update.isPending}
            onClick={save}
          >
            <IconDeviceFloppy className="size-4" />
            حفظ التعديلات
          </Button>
        )}
        {open && (
          <Button
            size="lg"
            className="col-span-2 gap-2"
            nativeButton={false}
            render={<Link href={PURCHASE_ORDER_ROUTES.receive(o.id)} />}
            disabled={dirty}
          >
            <IconPackageImport className="size-4" />
            استلام البضاعة (فاتورة شراء)
          </Button>
        )}
        <Button
          size="lg"
          variant="outline"
          className="gap-2"
          onClick={() => void whatsapp()}
        >
          <IconBrandWhatsapp className="size-4" />
          واتساب للمورد
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2"
          onClick={() => printOrder(o, shopName)}
        >
          <IconPrinter className="size-4" />
          طباعة
        </Button>
        {o.status === "draft" && (
          <Button
            size="lg"
            variant="outline"
            className="gap-2"
            disabled={markSent.isPending || dirty}
            onClick={() => markSent.mutate(o)}
          >
            <IconSend className="size-4" />
            تم الإرسال
          </Button>
        )}
        {open && (
          <Button
            size="lg"
            variant="outline"
            className={cn(
              "gap-2 text-destructive",
              o.status !== "draft" && "col-span-2",
            )}
            onClick={() => setConfirmCancel(true)}
          >
            <IconTrash className="size-4" />
            إلغاء الطلب
          </Button>
        )}
      </div>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader className="text-start">
            <DialogTitle>إلغاء طلب الشراء #{o.number}؟</DialogTitle>
            <DialogDescription>
              أصنافه ترجع تظهر في النواقص المقترحة. لا يؤثر على المخزون أو حساب
              المورد.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              رجوع
            </Button>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate(o, { onSuccess: () => setConfirmCancel(false) })
              }
            >
              إلغاء الطلب
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** تفاصيل طلب شراء: تعديل الكميات، إرسال للمورد، استلام، إلغاء. */
export function OrderDetailSheet({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const query = useOrder(orderId);
  const o = query.data;
  const info = o ? STATUS_INFO[o.status] : null;

  return (
    <Sheet open={orderId !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="left"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            طلب شراء #{o?.number ?? "…"}
            {info && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[11px] font-normal",
                  info.className,
                )}
              >
                {info.label}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            {o
              ? `${o.supplierName} · ${formatDate(o.createdAt)}`
              : "جارٍ التحميل…"}
          </SheetDescription>
        </SheetHeader>

        {!o ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          // key: نسخة جديدة من السيرفر (تعديل/تحديث لحظي) تبدأ بلا تعديلات معلّقة
          <OrderBody key={`${o.id}-${o.version}`} o={o} />
        )}
      </SheetContent>
    </Sheet>
  );
}
