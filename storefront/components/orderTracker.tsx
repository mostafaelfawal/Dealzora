"use client";

import {
  IconBrandWhatsapp,
  IconCircleCheckFilled,
  IconCircleX,
  IconConfetti,
  IconLoader2,
  IconPhone,
  IconRefresh,
} from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ApiError, storeApi } from "@/lib/client";
import { formatDateTime, formatQty, waLink } from "@/lib/format";
import type { OrderStatus, TrackedOrder } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Price } from "./price";
import { useStore } from "./storeContext";
import { Button, ButtonLink, Skeleton } from "./ui";

const STEPS: {
  status: OrderStatus;
  label: string;
  hint: string;
  key: keyof TrackedOrder;
}[] = [
  {
    status: "new",
    label: "تم استلام الطلب",
    hint: "بانتظار تأكيد المتجر",
    key: "created_at",
  },
  {
    status: "confirmed",
    label: "تم التأكيد",
    hint: "المتجر يجهّز طلبك",
    key: "confirmed_at",
  },
  {
    status: "delivering",
    label: "في الطريق إليك",
    hint: "المندوب خرج للتوصيل",
    key: "delivering_at",
  },
  {
    status: "delivered",
    label: "تم التسليم",
    hint: "شكراً لطلبك",
    key: "delivered_at",
  },
];

/** متابعة الطلب برابطه السري: المراحل، والأصناف، والإلغاء قبل التأكيد. تتحدّث كل 30 ثانية. */
export function OrderTracker({ token }: { token: string }) {
  const store = useStore();
  const fresh = useSearchParams().get("new") === "1";
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(
    () =>
      storeApi<TrackedOrder>(store.slug, `/orders/${token}`).then(
        (o) => {
          setOrder(o);
          setError(null);
        },
        (e) =>
          setError(
            e instanceof ApiError && e.status === 404
              ? "الطلب غير موجود. تأكد من الرابط."
              : "تعذّر تحميل الطلب",
          ),
      ),
    [store.slug, token],
  );

  useEffect(() => {
    const first = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [load]);

  async function cancel() {
    setCancelling(true);
    try {
      setOrder(
        await storeApi<TrackedOrder>(store.slug, `/orders/${token}/cancel`, {
          method: "POST",
        }),
      );
      setConfirmCancel(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "تعذّر إلغاء الطلب");
    } finally {
      setCancelling(false);
    }
  }

  if (error && !order)
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <IconCircleX className="mx-auto size-12 text-muted-foreground" />
        <p className="font-medium">{error}</p>
        <ButtonLink href={`/${store.slug}`} variant="outline">
          العودة للمتجر
        </ButtonLink>
      </div>
    );

  if (!order)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-56" />
      </div>
    );

  const cancelled = order.status === "cancelled";
  const reached = STEPS.findIndex((s) => s.status === order.status);
  const contact = store.whatsapp ?? store.phone;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {fresh && !cancelled && (
        <section className="flex items-start gap-3 border border-success/40 bg-success/10 p-4 animate-in fade-in slide-in-from-top-2">
          <IconConfetti className="size-7 shrink-0 text-success" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold">تم إرسال طلبك بنجاح</h1>
            <p className="text-sm text-muted-foreground">
              احفظ هذه الصفحة لمتابعة طلبك. سيتواصل معك المتجر لتأكيد الطلب،
              والدفع نقداً عند الاستلام.
            </p>
          </div>
        </section>
      )}

      <section className="space-y-4 border bg-card p-4">
        <header className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">
            طلب <span className="font-mono">#{order.number}</span>
          </h2>
          <span className="text-sm text-muted-foreground">
            {formatDateTime(order.created_at)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ms-auto"
            aria-label="تحديث"
            onClick={() => void load()}
          >
            <IconRefresh />
          </Button>
        </header>

        {cancelled ? (
          <div className="flex items-start gap-3 bg-destructive/10 p-3 text-destructive">
            <IconCircleX className="size-6 shrink-0" />
            <div>
              <p className="font-semibold">تم إلغاء الطلب</p>
              <p className="text-sm">
                {order.cancelled_by === "customer"
                  ? "ألغيت الطلب بنفسك."
                  : order.cancel_reason}
              </p>
            </div>
          </div>
        ) : (
          <ol className="space-y-0">
            {STEPS.map((s, i) => {
              const done = i <= reached;
              const current = i === reached;
              const at = order[s.key] as string | null;
              return (
                <li
                  key={s.status}
                  className="relative flex gap-3 pb-5 last:pb-0"
                >
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-7 bottom-0 start-[0.6875rem] w-0.5",
                        i < reached ? "bg-success" : "bg-border",
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex size-6 shrink-0 items-center justify-center",
                      done ? "text-success" : "text-muted-foreground/50",
                    )}
                  >
                    {done ? (
                      <IconCircleCheckFilled className="size-6" />
                    ) : (
                      <span className="size-3 rounded-full border-2 border-current" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm",
                        current
                          ? "font-bold"
                          : done
                            ? "font-medium"
                            : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {at ? formatDateTime(at) : s.hint}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="border bg-card">
        <h3 className="border-b p-4 font-bold">الأصناف</h3>
        <ul className="divide-y">
          {order.lines.map((l) => (
            <li
              key={l.gid}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatQty(l.qty)} {l.unit}
                </span>
              </span>
              <Price cents={l.line_total} currency={order.currency} />
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t p-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>الأصناف</dt>
            <dd>
              <Price cents={order.subtotal} currency={order.currency} />
            </dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>التوصيل</dt>
            <dd>
              {order.delivery_fee ? (
                <Price cents={order.delivery_fee} currency={order.currency} />
              ) : (
                "مجاني"
              )}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <dt>المطلوب عند الاستلام</dt>
            <dd>
              <Price
                cents={order.total}
                currency={order.currency}
                className="text-lg"
              />
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-1 border bg-card p-4 text-sm">
        <h3 className="mb-1 font-bold">التوصيل إلى</h3>
        <p>{order.customer_name}</p>
        <p className="text-muted-foreground whitespace-pre-line">
          {order.city ? `${order.city} — ` : ""}
          {order.address}
        </p>
        <p
          dir="ltr"
          className="text-end font-mono text-xs text-muted-foreground"
        >
          {order.phone}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <a
          href={`tel:${store.phone}`}
          className="inline-flex h-10 items-center gap-2 border px-4 text-sm hover:bg-muted"
        >
          <IconPhone className="size-4" />
          اتصل بالمتجر
        </a>
        <a
          href={waLink(contact, `مرحباً، بخصوص طلبي رقم #${order.number}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 border px-4 text-sm hover:bg-muted"
        >
          <IconBrandWhatsapp className="size-4" />
          واتساب
        </a>
        {order.can_cancel &&
          (confirmCancel ? (
            <span className="ms-auto flex items-center gap-2">
              <span className="text-sm">إلغاء الطلب؟</span>
              <Button
                variant="destructive"
                size="md"
                disabled={cancelling}
                onClick={() => void cancel()}
              >
                {cancelling ? <IconLoader2 className="animate-spin" /> : null}
                نعم، ألغِ
              </Button>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                لا
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              className="ms-auto text-destructive"
              onClick={() => setConfirmCancel(true)}
            >
              إلغاء الطلب
            </Button>
          ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
