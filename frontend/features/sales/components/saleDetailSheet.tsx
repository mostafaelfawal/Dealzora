"use client";

import {
  IconBrandWhatsapp,
  IconPrinter,
  IconReceiptRefund,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Money } from "@/components/shared/Money";
import { listItem, MotionLi } from "@/components/shared/motion";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useShopName } from "@/features/settings/hooks/useSettings";
import { useHotkey } from "@/hooks/useHotkey";
import { formatDateTime } from "@/lib/dates";
import { formatQty } from "@/lib/format";

import { SALE_SHORTCUTS } from "../config/saleOptions";
import { useSale } from "../hooks/useSales";
import { printReceipt, sendWhatsapp } from "../lib/receipt";
import type { Sale } from "../types/sale";
import { SaleBadges } from "./saleBadges";

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? "text-sm font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** تفاصيل الفاتورة: الأصناف والدفع والربح + طباعة/واتساب/مرتجع باختصارات. */
export function SaleDetailSheet({
  saleId,
  onClose,
  onReturn,
}: {
  saleId: string | null;
  onClose: () => void;
  onReturn: (sale: Sale) => void;
}) {
  const query = useSale(saleId);
  const shop = useShopName();
  const sale = query.data;
  const shopName = shop.data ?? "Dealzora";
  const open = saleId !== null;

  const print = () => sale && printReceipt(sale, shopName);
  const whatsapp = () =>
    sale &&
    sendWhatsapp(sale, shopName, sale.customerPhone).catch(() =>
      toast.error("تعذّر فتح واتساب"),
    );

  useHotkey(SALE_SHORTCUTS.print.match, () => open && print());
  useHotkey(SALE_SHORTCUTS.whatsapp.match, () => open && void whatsapp());
  useHotkey(SALE_SHORTCUTS.returnSale.match, () => open && sale && onReturn(sale));

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="left" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            فاتورة #{sale?.number ?? "…"}
            {sale && <SaleBadges sale={sale} />}
          </SheetTitle>
          <SheetDescription>
            {sale
              ? `${formatDateTime(sale.soldAt)} · ${sale.cashierName ?? "—"} · ${sale.customerName ?? "عميل نقدي"}`
              : "جارٍ التحميل…"}
          </SheetDescription>
        </SheetHeader>

        {!sale ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 p-4">
            <ul className="divide-y border">
              {sale.lines.map((l, i) => (
                <MotionLi key={l.id} {...listItem(i)} className="flex items-start gap-3 p-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.name}</span>
                    <span className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                      {formatQty(l.qty)} {l.unitName} ×
                      <Money amount={l.unitPrice} className="text-[11px]" />
                      {l.discount > 0 && (
                        <span className="text-warning">
                          · خصم <Money amount={l.discount} className="text-[11px]" />
                        </span>
                      )}
                      {l.returnedQty > 0 && (
                        <span className="text-destructive">· رجع {formatQty(l.returnedQty)}</span>
                      )}
                    </span>
                  </span>
                  <Money amount={l.lineTotal} className="text-sm" />
                </MotionLi>
              ))}
            </ul>

            <dl className="space-y-1.5 text-xs">
              <Row label="الإجمالي قبل الخصم">
                <Money amount={sale.subtotal} />
              </Row>
              {sale.linesDiscount + sale.invoiceDiscount > 0 && (
                <Row label="الخصم">
                  <Money amount={sale.linesDiscount + sale.invoiceDiscount} />
                </Row>
              )}
              <Row label="الإجمالي" strong>
                <Money amount={sale.total} className="text-xl" />
              </Row>
              <Separator className="my-2" />
              {sale.cashAmount > 0 && (
                <Row label="كاش">
                  <Money amount={sale.cashAmount} />
                </Row>
              )}
              {sale.change > 0 && (
                <Row label={`استلم ${sale.received} والباقي`}>
                  <Money amount={sale.change} />
                </Row>
              )}
              {sale.creditAmount > 0 && (
                <Row label={`آجل على ${sale.customerName ?? "العميل"}`}>
                  <Money amount={sale.creditAmount} className="text-warning" />
                </Row>
              )}
              {sale.returnedTotal > 0 && (
                <Row label="مرتجع">
                  <Money amount={sale.returnedTotal} className="text-destructive" />
                </Row>
              )}
              {sale.profit !== null && (
                <Row label="صافي الربح">
                  <Money
                    amount={sale.profit}
                    className={sale.profit < 0 ? "text-destructive" : "text-success"}
                  />
                </Row>
              )}
              {sale.note && (
                <p className="pt-1 text-muted-foreground">ملاحظة: {sale.note}</p>
              )}
            </dl>

            <div className="mt-auto grid grid-cols-2 gap-2">
              <Button size="lg" onClick={print} className="gap-2">
                <IconPrinter className="size-4" />
                طباعة
                <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
                  {SALE_SHORTCUTS.print.label}
                </ShortcutBadge>
              </Button>
              <Button size="lg" variant="outline" onClick={() => void whatsapp()} className="gap-2">
                <IconBrandWhatsapp className="size-4 text-success" />
                واتساب
                <ShortcutBadge className="hidden lg:inline-flex">
                  {SALE_SHORTCUTS.whatsapp.label}
                </ShortcutBadge>
              </Button>
              <Button
                size="lg"
                variant="outline"
                disabled={sale.returnedTotal >= sale.total && sale.total > 0}
                onClick={() => onReturn(sale)}
                className="col-span-2 gap-2"
              >
                <IconReceiptRefund className="size-4" />
                مرتجع من هذه الفاتورة
                <ShortcutBadge className="hidden lg:inline-flex">
                  {SALE_SHORTCUTS.returnSale.label}
                </ShortcutBadge>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
