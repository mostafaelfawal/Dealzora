"use client";

import {
  IconBrandWhatsapp,
  IconCalendarEvent,
  IconCheck,
  IconDeviceFloppy,
  IconPackageExport,
  IconRotate,
  IconTrash,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toWhatsappNumber } from "@/features/sales/lib/receipt";
import { useShopName } from "@/features/settings/hooks/useSettings";
import { formatDateTime, todayIso } from "@/lib/dates";
import { formatMoneyText, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { openWhatsapp } from "@/lib/whatsapp";

import {
  RESERVATION_ROUTES,
  RESERVATION_STATUS_INFO,
} from "../config/reservationOptions";
import {
  useCancelReservation,
  useReservation,
  useSetReady,
  useUpdateReservation,
} from "../hooks/useReservations";
import { setPendingPickup } from "../lib/pendingPickup";
import { formatPickup } from "../lib/reservationText";
import type { Reservation } from "../types/reservation";

const DEFAULT_SHOP_NAME = "Dealzora";

function readyMessage(r: Reservation, shopName: string) {
  const due = Math.max(r.total - r.deposit, 0);
  return [
    `أهلاً ${r.customerName}،`,
    `حجزك رقم #${r.number} لدى ${shopName} جاهز للاستلام.`,
    r.deposit > 0
      ? `العربون المدفوع ${formatMoneyText(r.deposit)}، والباقي تقريباً ${formatMoneyText(due)}.`
      : `الإجمالي تقريباً ${formatMoneyText(r.total)}.`,
    "",
    "بانتظارك، شكراً لك.",
  ].join("\n");
}

function ReservationBody({
  r,
  onClose,
}: {
  r: Reservation;
  onClose: () => void;
}) {
  const router = useRouter();
  const shopName = useShopName().data ?? DEFAULT_SHOP_NAME;
  const setReady = useSetReady();
  const update = useUpdateReservation();
  const cancel = useCancelReservation();
  const [pickupOn, setPickupOn] = useState(r.pickupOn ?? "");
  const [note, setNote] = useState(r.note ?? "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const open = r.status === "pending" || r.status === "ready";
  const dirty = pickupOn !== (r.pickupOn ?? "") || note !== (r.note ?? "");
  const due = Math.max(r.total - r.deposit, 0);

  function pickup() {
    setPendingPickup(r.id);
    router.push(RESERVATION_ROUTES.pos);
  }

  async function whatsapp() {
    const number = r.customerPhone ? toWhatsappNumber(r.customerPhone) : null;
    try {
      await openWhatsapp(number ?? "", readyMessage(r, shopName));
    } catch {
      toast.error("تعذّر فتح واتساب");
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="border p-2">
          <p className="text-[11px] text-muted-foreground">التقديري</p>
          <Money amount={r.total} className="text-base" />
        </div>
        <div className="border p-2">
          <p className="text-[11px] text-muted-foreground">العربون</p>
          <Money amount={r.deposit} className="text-base" />
        </div>
        <div className="border bg-muted/40 p-2">
          <p className="text-[11px] text-muted-foreground">الباقي</p>
          <Money amount={due} className="text-base font-semibold" />
        </div>
      </div>

      <ul className="divide-y border">
        {r.invoice.lines.map((l, i) => (
          <li
            key={`${l.productId}-${l.unitId ?? ""}-${i}`}
            className="flex items-center gap-2 p-2.5"
          >
            <span className="min-w-0 flex-1">
              <AppTooltip message={l.name} onlyWhenTruncated>
                <span className="block truncate text-sm font-medium">
                  {l.name}
                </span>
              </AppTooltip>
              <span className="text-[11px] text-muted-foreground">
                <Num>{formatQty(l.qty)}</Num> {l.unit} ×{" "}
                <Num>{formatQty(l.price)}</Num>
              </span>
            </span>
            <Money
              amount={Math.max(
                l.price * l.qty - (l.discount ?? 0) - (l.promo ?? 0),
                0,
              )}
              className="text-sm"
            />
          </li>
        ))}
      </ul>
      <p className="-mt-2 text-[11px] text-muted-foreground">
        الأسعار وقت الحجز. عند الاستلام تُحسب بأسعار اليوم، والعربون يُخصم من رصيد
        العميل.
      </p>

      {open ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="res-pickup">موعد الاستلام</Label>
            <Input
              id="res-pickup"
              type="date"
              dir="ltr"
              min={todayIso()}
              value={pickupOn}
              onChange={(e) => setPickupOn(e.target.value)}
              className="h-10 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-note">ملاحظة</Label>
            <Textarea
              id="res-note"
              rows={2}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {dirty && (
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  id: r.id,
                  pickupOn: pickupOn || null,
                  note: note || null,
                })
              }
            >
              <IconDeviceFloppy className="size-4" />
              حفظ التعديلات
            </Button>
          )}
        </div>
      ) : (
        r.note && <p className="border bg-muted/40 p-2.5 text-sm">{r.note}</p>
      )}

      <dl className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>سُجّل</dt>
          <dd>
            {formatDateTime(r.createdAt)}
            {r.cashierName && ` · ${r.cashierName}`}
          </dd>
        </div>
        {r.closedAt && (
          <div className="flex justify-between gap-2">
            <dt>{r.status === "picked_up" ? "استُلم" : "أُلغي"}</dt>
            <dd>
              {formatDateTime(r.closedAt)}
              {r.saleNumber && ` · فاتورة #${r.saleNumber}`}
            </dd>
          </div>
        )}
        {r.status === "cancelled" && r.deposit > 0 && (
          <p className="pt-1">
            العربون بقي رصيداً للعميل لدى المحل، ويمكن صرفه من صفحة العملاء.
          </p>
        )}
      </dl>

      {open && (
        <div className="mt-auto grid grid-cols-2 gap-2 border-t pt-4">
          <Button
            size="lg"
            className="col-span-2 gap-2"
            disabled={dirty}
            onClick={pickup}
          >
            <IconPackageExport className="size-4" />
            استلام في الكاشير
          </Button>
          {r.status === "pending" ? (
            <Button
              size="lg"
              variant="outline"
              className="gap-2"
              disabled={setReady.isPending}
              onClick={() => setReady.mutate({ id: r.id, ready: true })}
            >
              <IconCheck className="size-4" />
              جاهز للاستلام
            </Button>
          ) : (
            <Button
              size="lg"
              variant="outline"
              className="gap-2"
              disabled={setReady.isPending}
              onClick={() => setReady.mutate({ id: r.id, ready: false })}
            >
              <IconRotate className="size-4" />
              إعادة للتجهيز
            </Button>
          )}
          <Button
            size="lg"
            variant="outline"
            className="gap-2"
            onClick={() => void whatsapp()}
          >
            <IconBrandWhatsapp className="size-4" />
            إبلاغ العميل
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="col-span-2 gap-2 text-destructive"
            onClick={() => setConfirmCancel(true)}
          >
            <IconTrash className="size-4" />
            إلغاء الحجز
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title={`إلغاء الحجز #${r.number}؟`}
        description={
          r.deposit > 0
            ? `العربون (${formatMoneyText(r.deposit)}) لا يُرد تلقائياً: يبقى رصيداً للعميل لدى المحل، يُدفع منه في أي فاتورة أو يُصرف نقداً من صفحة العملاء.`
            : "لا يؤثر الإلغاء في المخزون أو حساب العميل."
        }
        confirmLabel="إلغاء الحجز"
        onClose={() => setConfirmCancel(false)}
        onConfirm={() =>
          cancel.mutate(r.id, {
            onSuccess: () => {
              setConfirmCancel(false);
              onClose();
            },
          })
        }
      />
    </div>
  );
}

/** تفاصيل حجز: الأصناف والعربون، وتعديل الموعد، وجاهز/استلام/إلغاء. */
export function ReservationDetailSheet({
  reservationId,
  onClose,
}: {
  reservationId: string | null;
  onClose: () => void;
}) {
  const query = useReservation(reservationId);
  const r = query.data?.id === reservationId ? query.data : null;
  const info = r ? RESERVATION_STATUS_INFO[r.status] : null;

  return (
    <Sheet
      open={reservationId !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <SheetContent
        side="left"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <IconCalendarEvent className="size-4 text-muted-foreground" />
            حجز #{r?.number ?? "…"}
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
            {r ? (
              <>
                {r.customerName}
                {r.customerPhone && (
                  <>
                    {" · "}
                    <bdi dir="ltr" className="font-mono">
                      {r.customerPhone}
                    </bdi>
                  </>
                )}
                {" · "}
                <span className={cn(r.isOverdue && "text-destructive")}>
                  {formatPickup(r.pickupOn)}
                </span>
              </>
            ) : (
              "…"
            )}
          </SheetDescription>
        </SheetHeader>
        {/* key: الحقول تبدأ من جديد عند فتح حجز آخر. */}
        {r ? (
          <ReservationBody key={r.id} r={r} onClose={onClose} />
        ) : (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
