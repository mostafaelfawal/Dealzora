"use client";

import {
  IconBrandWhatsapp,
  IconPrinter,
  IconReceiptRefund,
} from "@tabler/icons-react";
import { toast } from "sonner";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
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

import { SALE_SHORTCUTS } from "../config/saleOptions";
import { useSale } from "../hooks/useSales";
import { printReceipt, sendWhatsapp } from "../lib/receipt";
import type { Sale } from "../types/sale";
import { SaleBadges } from "./saleBadges";
import { SaleLinesList, SaleTotals } from "./saleDetailParts";

const DEFAULT_SHOP_NAME = "Dealzora";

const saleSubtitle = (sale: Sale) =>
  `${formatDateTime(sale.soldAt)} · ${sale.cashierName ?? "—"} · ${sale.customerName ?? "عميل نقدي"}`;

/** المرتجع غير متاح لو رجعت الفاتورة كلها. */
const fullyReturned = (sale: Sale) =>
  sale.returnedTotal >= sale.total && sale.total > 0;

function SaleActions({
  sale,
  onPrint,
  onWhatsapp,
  onReturn,
}: {
  sale: Sale;
  onPrint: () => void;
  onWhatsapp: () => void;
  onReturn: () => void;
}) {
  return (
    <div className="mt-auto grid grid-cols-2 gap-2">
      <Button size="lg" onClick={onPrint} className="gap-2">
        <IconPrinter className="size-4" />
        طباعة
        <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
          {SALE_SHORTCUTS.print.label}
        </ShortcutBadge>
      </Button>
      <Button
        size="lg"
        variant="outline"
        onClick={onWhatsapp}
        className="gap-2"
      >
        <IconBrandWhatsapp className="size-4 text-success" />
        واتساب
        <ShortcutBadge className="hidden lg:inline-flex">
          {SALE_SHORTCUTS.whatsapp.label}
        </ShortcutBadge>
      </Button>
      <Button
        size="lg"
        variant="outline"
        disabled={fullyReturned(sale)}
        onClick={onReturn}
        className="col-span-2 gap-2"
      >
        <IconReceiptRefund className="size-4" />
        مرتجع من هذه الفاتورة
        <ShortcutBadge className="hidden lg:inline-flex">
          {SALE_SHORTCUTS.returnSale.label}
        </ShortcutBadge>
      </Button>
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
  const shopName = shop.data ?? DEFAULT_SHOP_NAME;
  const open = saleId !== null;

  const print = () => sale && printReceipt(sale, shopName);
  const whatsapp = () =>
    sale &&
    sendWhatsapp(sale, shopName, sale.customerPhone).catch(() =>
      toast.error("تعذّر فتح واتساب"),
    );

  useHotkey(SALE_SHORTCUTS.print.match, () => open && print());
  useHotkey(SALE_SHORTCUTS.whatsapp.match, () => open && void whatsapp());
  useHotkey(
    SALE_SHORTCUTS.returnSale.match,
    () => open && sale && onReturn(sale),
  );

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="left"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            فاتورة #{sale?.number ?? "…"}
            {sale && <SaleBadges sale={sale} />}
          </SheetTitle>
          <SheetDescription>
            {sale ? saleSubtitle(sale) : "جارٍ التحميل…"}
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
            <SaleLinesList lines={sale.lines} />
            <SaleTotals sale={sale} />
            <SaleActions
              sale={sale}
              onPrint={print}
              onWhatsapp={() => void whatsapp()}
              onReturn={() => onReturn(sale)}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
