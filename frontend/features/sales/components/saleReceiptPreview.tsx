"use client";

import {
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import type { PointerEvent, ReactNode } from "react";

import { listItem, MotionDiv, MotionLi } from "@/components/shared/motion";
import { Money } from "@/components/shared/Money";
import { formatDateTime } from "@/lib/dates";
import { formatQty } from "@/lib/format";
import { useMotionPreference } from "@/lib/motionPreference";
import { cn } from "@/lib/utils";

import type { Sale } from "../types/sale";

/** أقصى ميل للإيصال مع حركة الماوس (درجات). */
const MAX_TILT = 7;
const TILT_SPRING = { stiffness: 170, damping: 18, mass: 0.6 };

/**
 * خروج الإيصال من فتحة الطابعة: ينزل من خلفها مع انحناء خفيف للأمام ثم يستقر.
 * عند إيقاف الحركة من الإعدادات (MotionGlobalConfig.skipAnimations) يظهر مباشرة في مكانه.
 */
const PRINT_OUT = {
  initial: { y: "-101%", rotateX: -22, opacity: 0.7 },
  animate: { y: 0, rotateX: 0, opacity: 1 },
  transition: {
    y: { type: "spring", stiffness: 60, damping: 15, mass: 1.1 },
    rotateX: { type: "spring", stiffness: 80, damping: 9, delay: 0.25 },
    opacity: { duration: 0.2 },
  },
} as const;

function Row({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <dt>{label}</dt>
      <dd className="shrink-0">{children}</dd>
    </div>
  );
}

const Rule = () => <hr aria-hidden className="receipt-rule my-3" />;

/** ميل ثلاثي الأبعاد مع الماوس ولمعة تتحرك على الورق. يتوقف مع إيقاف الحركة. */
function useTilt(enabled: boolean) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const rotateY = useSpring(
    useTransform(px, [-0.5, 0.5], [-MAX_TILT, MAX_TILT]),
    TILT_SPRING,
  );
  const rotateX = useSpring(
    useTransform(py, [-0.5, 0.5], [MAX_TILT, -MAX_TILT]),
    TILT_SPRING,
  );
  const sheenX = useTransform(px, [-0.5, 0.5], ["15%", "85%"]);
  const sheenY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const sheen = useMotionTemplate`radial-gradient(90% 55% at ${sheenX} ${sheenY}, oklch(1 0 0 / 0.5), transparent 70%)`;

  const reset = () => {
    px.set(0);
    py.set(0);
  };
  const handlers = enabled
    ? {
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width - 0.5);
          py.set((e.clientY - r.top) / r.height - 0.5);
        },
        onPointerLeave: reset,
      }
    : {};

  return {
    handlers,
    style: enabled ? { rotateX, rotateY } : undefined,
    sheen: enabled ? sheen : undefined,
  };
}

/** معاينة الفاتورة كإيصال ورقي مقصوص يخرج من الطابعة (شاشة الفواتير والمرتجعات). */
export function SaleReceiptPreview({
  sale,
  shopName,
}: {
  sale: Sale;
  shopName: string;
}) {
  const { reduced } = useMotionPreference();
  const tilt = useTilt(!reduced);
  const discount = sale.linesDiscount + sale.invoiceDiscount;

  return (
    <div className="relative mx-auto w-full max-w-85 pt-2">
      <div
        aria-hidden
        className="receipt-slot absolute -inset-x-3 top-0 z-10 h-4 rounded-full"
      />
      {/* القص عند خط الفتحة فقط؛ الهوامش تترك مكاناً للظل على الجوانب وأسفل. */}
      <div
        className="-mx-6 overflow-hidden px-6 pb-10"
        style={{ perspective: 1100 }}
      >
        <MotionDiv {...PRINT_OUT} style={{ transformOrigin: "top center" }}>
          <MotionDiv
            {...tilt.handlers}
            style={tilt.style}
            className="receipt-shadow"
          >
            <article
              aria-label={`إيصال فاتورة رقم ${sale.number}`}
              className="receipt-paper relative px-5 text-xs"
            >
              {tilt.sheen && (
                <MotionDiv
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ background: tilt.sheen }}
                />
              )}

              <header className="space-y-0.5 text-center">
                <p className="text-base font-bold">{shopName}</p>
                <p className="text-muted-foreground">
                  فاتورة رقم{" "}
                  <b className="font-mono text-foreground">#{sale.number}</b>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDateTime(sale.soldAt)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  الكاشير: {sale.cashierName ?? "—"} · العميل:{" "}
                  {sale.customerName ?? "عميل نقدي"}
                </p>
              </header>

              <Rule />

              <ul className="space-y-2">
                {sale.lines.map((l, i) => (
                  <MotionLi key={l.id} {...listItem(i + 6)}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 font-semibold wrap-break-word">
                        {l.name}
                      </span>
                      <Money amount={l.lineTotal} className="shrink-0 text-xs" />
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-baseline gap-1">
                        {formatQty(l.qty)} {l.unitName} ×
                        <Money amount={l.unitPrice} className="text-[11px]" />
                      </span>
                      {l.isWholesale && <span>· جملة</span>}
                      {l.promoDiscount > 0 && (
                        <span className="inline-flex items-baseline gap-1 text-success">
                          · {l.promoName ?? "عرض"} −
                          <Money amount={l.promoDiscount} className="text-[11px]" />
                        </span>
                      )}
                      {l.discount > 0 && (
                        <span className="inline-flex items-baseline gap-1 text-warning">
                          · خصم
                          <Money amount={l.discount} className="text-[11px]" />
                        </span>
                      )}
                      {l.returnedQty > 0 && (
                        <span className="text-destructive">
                          · رجع {formatQty(l.returnedQty)}
                        </span>
                      )}
                    </div>
                  </MotionLi>
                ))}
              </ul>

              <Rule />

              <dl className="space-y-1">
                <Row label="الإجمالي قبل الخصم">
                  <Money amount={sale.subtotal} className="text-xs" />
                </Row>
                {sale.promoDiscount > 0 && (
                  <Row label="العروض" className="text-success">
                    <Money amount={sale.promoDiscount} className="text-xs" />
                  </Row>
                )}
                {discount > 0 && (
                  <Row label="الخصم" className="text-warning">
                    <Money amount={discount} className="text-xs" />
                  </Row>
                )}
                {sale.loyaltyDiscount > 0 && (
                  <Row label={`خصم ${sale.loyaltyRedeemed} نقطة`}>
                    <Money amount={sale.loyaltyDiscount} className="text-xs" />
                  </Row>
                )}
                <Row
                  label="الإجمالي"
                  className="pt-1 text-base font-bold"
                >
                  <Money amount={sale.total} className="text-lg" />
                </Row>
              </dl>

              <Rule />

              <dl className="space-y-1">
                <Row label="طريقة الدفع">{sale.paymentLabel}</Row>
                {sale.cashAmount > 0 && (
                  <Row label="المدفوع نقداً">
                    <Money
                      amount={sale.received || sale.cashAmount}
                      className="text-xs"
                    />
                  </Row>
                )}
                {sale.change > 0 && (
                  <Row label="الباقي">
                    <Money amount={sale.change} className="text-xs" />
                  </Row>
                )}
                {sale.creditAmount > 0 && (
                  <Row label="آجل على الحساب" className="text-warning">
                    <Money amount={sale.creditAmount} className="text-xs" />
                  </Row>
                )}
                {sale.walletAmount > 0 && (
                  <Row label={`مدفوع ${sale.paymentLabel}`}>
                    <Money amount={sale.walletAmount} className="text-xs" />
                  </Row>
                )}
                {sale.walletAmount > 0 && sale.paymentRef && (
                  <Row label="رقم العملية">
                    <bdi dir="ltr" className="font-mono">
                      {sale.paymentRef}
                    </bdi>
                  </Row>
                )}
                {sale.returnedTotal > 0 && (
                  <Row label="مرتجع من الفاتورة" className="text-destructive">
                    <Money amount={sale.returnedTotal} className="text-xs" />
                  </Row>
                )}
              </dl>

              {sale.customerPoints !== null &&
                (sale.loyaltyEarned > 0 || sale.loyaltyRedeemed > 0) && (
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    كسب {sale.loyaltyEarned} نقطة · رصيده الآن{" "}
                    {sale.customerPoints} نقطة
                  </p>
                )}

              <Rule />

              <footer className="space-y-2 text-center">
                <p>شكراً لزيارتكم</p>
                <div aria-hidden className="receipt-barcode mx-auto h-9 w-44" />
                <p className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground">
                  {String(sale.number).padStart(8, "0")}
                </p>
              </footer>
            </article>
          </MotionDiv>
        </MotionDiv>
      </div>
    </div>
  );
}
