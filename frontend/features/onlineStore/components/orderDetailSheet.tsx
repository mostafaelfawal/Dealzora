"use client";

import {
  IconBrandWhatsapp,
  IconCheck,
  IconCopy,
  IconMapPin,
  IconNote,
  IconPhone,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/shared/Money";
import { SavingLabel } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { formatWhen } from "@/lib/dates";
import { openExternal } from "@/lib/external";
import { cn } from "@/lib/utils";

import {
  useSetOrderNote,
  useSetOrderStatus,
  useStoreOrder,
} from "../hooks/useOnlineStore";
import {
  CANCEL_REASONS,
  formatQtyUnit,
  isOpen,
  NEXT_STEP,
  ORDER_STATUS,
  orderWhatsappText,
  waNumber,
} from "../lib/storeText";
import type { OrderStatus, StoreOrderDetail } from "../types/store";

export function StatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const s = ORDER_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center px-1.5 py-0.5 text-[11px] font-medium",
        s.className,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

const STEPS: { status: OrderStatus; key: keyof StoreOrderDetail }[] = [
  { status: "new", key: "createdAt" },
  { status: "confirmed", key: "confirmedAt" },
  { status: "delivering", key: "deliveringAt" },
  { status: "delivered", key: "deliveredAt" },
];

function Timeline({ order }: { order: StoreOrderDetail }) {
  const cancelled = order.status === "cancelled";
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="مراحل الطلب">
      {STEPS.map((step, i) => {
        const at = order[step.key] as number | null;
        const done = at !== null;
        return (
          <li key={step.status} className="space-y-1.5">
            <span
              className={cn(
                "block h-1",
                done && !cancelled
                  ? "bg-success"
                  : done
                    ? "bg-muted-foreground/40"
                    : "bg-muted",
              )}
            />
            <span
              className={cn(
                "block text-[11px]",
                done ? "font-medium" : "text-muted-foreground",
              )}
            >
              {i === 0 ? "وصل" : ORDER_STATUS[step.status].label}
            </span>
            {at && (
              <span className="block text-[10px] text-muted-foreground">
                {formatWhen(at)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CancelForm({
  order,
  onClose,
}: {
  order: { id: string; number: number };
  onClose: () => void;
}) {
  const mutation = useSetOrderStatus();
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 3;
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {CANCEL_REASONS.map((r) => (
          <Button
            key={r}
            type="button"
            size="sm"
            variant={reason === r ? "default" : "outline"}
            className="font-normal"
            onClick={() => setReason(r)}
          >
            {r}
          </Button>
        ))}
      </div>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={200}
        rows={2}
        placeholder="أو اكتب سبباً آخر"
        aria-label="سبب الإلغاء"
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          رجوع
        </Button>
        <Button
          variant="destructive"
          disabled={!valid || mutation.isPending}
          onClick={() =>
            mutation.mutate(
              { id: order.id, status: "cancelled", reason: reason.trim() },
              { onSuccess: onClose },
            )
          }
        >
          {mutation.isPending ? (
            <SavingLabel text="جارٍ الإلغاء…" />
          ) : (
            "إلغاء الطلب"
          )}
        </Button>
      </div>
    </>
  );
}

export function CancelOrderDialog({
  order,
  onClose,
}: {
  order: { id: string; number: number } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={order !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle>إلغاء الطلب #{order?.number}</DialogTitle>
          <DialogDescription>
            السبب يظهر للعميل في صفحة متابعة طلبه، فاكتبه بوضوح ولطف.
          </DialogDescription>
        </DialogHeader>
        {order && <CancelForm key={order.id} order={order} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function OwnerNote({ order }: { order: StoreOrderDetail }) {
  const [note, setNote] = useState(order.ownerNote ?? "");
  const mutation = useSetOrderNote();
  const dirty = (order.ownerNote ?? "") !== note.trim();
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold">
        <IconNote className="size-3.5" />
        ملاحظة داخلية
        <span className="font-normal text-muted-foreground">
          (لا يراها العميل)
        </span>
      </h3>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="مثال: المندوب أحمد، يُسلَّم بعد العصر"
        aria-label="ملاحظة داخلية"
      />
      {dirty && (
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate({ id: order.id, note: note || null })}
        >
          {mutation.isPending ? <SavingLabel /> : "حفظ الملاحظة"}
        </Button>
      )}
    </section>
  );
}

/** تفاصيل الطلب: المراحل، العميل (اتصال/واتساب)، الأصناف، والإجراء التالي. */
export function OrderDetailSheet({
  orderId,
  storeName,
  onClose,
}: {
  orderId: string | null;
  storeName: string;
  onClose: () => void;
}) {
  const query = useStoreOrder(orderId);
  const order = query.data;
  const step = order ? NEXT_STEP[order.status] : undefined;
  const mutation = useSetOrderStatus();
  const [cancelling, setCancelling] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const copyAddress = () => {
    if (!order) return;
    const text = [order.customerName, order.phone, order.city, order.address]
      .filter(Boolean)
      .join("\n");
    void copy(text).then((ok) => ok && toast.success("نُسخت بيانات التوصيل"));
  };

  return (
    <Sheet open={orderId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b p-4 text-start">
          <SheetTitle className="flex items-center gap-2 text-base">
            طلب #{order?.number ?? "…"}
            {order && <StatusBadge status={order.status} />}
          </SheetTitle>
          <SheetDescription>
            {order
              ? `${formatWhen(order.createdAt)} · ${order.itemsCount} صنف · الدفع عند الاستلام`
              : "جارٍ التحميل…"}
          </SheetDescription>
        </SheetHeader>

        {!order ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <Timeline order={order} />

              {order.status === "cancelled" && (
                <p className="border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                  {order.cancelledBy === "customer"
                    ? "ألغى العميل الطلب بنفسه."
                    : `أُلغي الطلب: ${order.cancelReason ?? ""}`}
                </p>
              )}

              <section className="space-y-2 border bg-card p-3">
                <div className="flex items-start gap-2">
                  <IconUser className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.previousOrders > 0
                        ? `عميل متكرر · ${order.previousOrders} طلب سابق`
                        : "أول طلب من هذا الرقم"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <IconMapPin className="mt-0.5 size-4 text-muted-foreground" />
                  <p className="min-w-0 flex-1 text-sm whitespace-pre-line">
                    {order.city ? `${order.city} — ` : ""}
                    {order.address}
                  </p>
                </div>
                {order.notes && (
                  <p className="border-s-2 border-primary/40 ps-2 text-xs whitespace-pre-line text-muted-foreground">
                    ملاحظة العميل: {order.notes}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => void openExternal(`tel:${order.phone}`)}
                  >
                    <IconPhone className="size-4" />
                    <span dir="ltr" className="font-mono">
                      {order.phone}
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      void openExternal(
                        `https://wa.me/${waNumber(order.phone)}?text=${encodeURIComponent(orderWhatsappText(order, storeName))}`,
                      )
                    }
                  >
                    <IconBrandWhatsapp className="size-4" />
                    واتساب
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={copyAddress}
                  >
                    {copied ? (
                      <IconCheck className="size-4" />
                    ) : (
                      <IconCopy className="size-4" />
                    )}
                    نسخ بيانات التوصيل
                  </Button>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold">الأصناف</h3>
                <ul className="divide-y border">
                  {order.lines.map((l) => (
                    <li
                      key={l.gid}
                      className="flex items-center gap-3 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {l.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {formatQtyUnit(l.qty, l.unit)} ×{" "}
                          <Money amount={l.unitPrice} className="text-xs" />
                          {l.barcode && (
                            <span dir="ltr" className="ms-2 font-mono">
                              {l.barcode}
                            </span>
                          )}
                        </span>
                      </span>
                      <Money amount={l.lineTotal} />
                    </li>
                  ))}
                </ul>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <dt>الأصناف</dt>
                    <dd>
                      <Money amount={order.subtotal} />
                    </dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>التوصيل</dt>
                    <dd>
                      {order.deliveryFee > 0 ? (
                        <Money amount={order.deliveryFee} />
                      ) : (
                        "مجاني"
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <dt>المطلوب تحصيله</dt>
                    <dd>
                      <Money amount={order.total} className="text-base" />
                    </dd>
                  </div>
                </dl>
              </section>

              <OwnerNote
                key={`${order.id}:${order.ownerNote ?? ""}`}
                order={order}
              />
            </div>

            {isOpen(order.status) && (
              <div className="flex gap-2 border-t p-4">
                {step && (
                  <Button
                    size="lg"
                    className="h-11 flex-1 gap-2"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({ id: order.id, status: step.status })
                    }
                  >
                    {mutation.isPending ? (
                      <SavingLabel text="جارٍ التحديث…" />
                    ) : (
                      <>
                        <IconCheck className="size-4" />
                        {step.label}
                      </>
                    )}
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 gap-2 text-destructive"
                  onClick={() => setCancelling(true)}
                >
                  <IconX className="size-4" />
                  إلغاء
                </Button>
              </div>
            )}
          </>
        )}
        <CancelOrderDialog
          order={cancelling && order ? order : null}
          onClose={() => setCancelling(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
