"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { toast } from "sonner";

import { POS_CATEGORIES, POS_CUSTOMERS, POS_PRODUCTS } from "../mocks/posData";
import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import { useHotkey } from "@/hooks/useHotkey";
import { usePosCart } from "../hooks/usePosCart";
import { formatMoneyText, parseEntry, searchProducts } from "../lib/posCalc";
import { cn } from "cn";
import type {
  InvoiceDiscount,
  PaymentMethod,
  PaymentResult,
  PosCustomer,
  PosProduct,
} from "../types/pos";

import { PosCancelDialog } from "./posCancelDialog";
import { PosCartPanel } from "./posCartPanel";
import { PosCustomerDialog } from "./posCustomerDialog";
import { PosDiscountDialog } from "./posDiscountDialog";
import { PosHeldDialog } from "./posHeldDialog";
import { PosPaymentDialog } from "./posPaymentDialog";
import { PosProductPane } from "./posProductPane";
import { PosShortcutsDialog } from "./posShortcutsDialog";
import { PosTopBar } from "./posTopBar";

type DialogName =
  "payment" | "discount" | "customer" | "held" | "cancel" | "shortcuts" | null;

type MobileView = "products" | "cart";

/** الفوكس التلقائي على الباركود للماوس والكيبورد بس. على التاتش بيفتح الكيبورد الافتراضي فنتجنبه. */
const hasFinePointer = () => window.matchMedia("(pointer: fine)").matches;

export function PosWorkspace() {
  const cart = usePosCart();
  const { invoice, totals, selectedId } = cart;
  const isEmpty = invoice.lines.length === 0;

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [dialog, setDialog] = useState<DialogName>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [reopenPayment, setReopenPayment] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("products");
  const searchRef = useRef<HTMLInputElement>(null);

  const entry = useMemo(() => parseEntry(query), [query]);
  const results = useMemo(
    () => searchProducts(POS_PRODUCTS, entry.term),
    [entry.term],
  );
  const searching = entry.term !== "";
  const safeIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  /* ---------- الفوكس ---------- */

  function focusSearch(force = false) {
    if (!force && !hasFinePointer()) return;
    searchRef.current?.focus();
  }

  // أول تحميل وبعد قفل أي نافذة: الفوكس يرجع لخانة الباركود.
  useEffect(() => {
    if (dialog !== null || !hasFinePointer()) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [dialog]);

  // قارئ الباركود بيكتب أرقام: لو الفوكس مش في خانة إدخال، نرجّعه للباركود قبل ما الحرف يضيع.
  useEffect(() => {
    if (dialog !== null) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1 || event.key === " ") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']"))
        return;
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog]);

  function handleRootClick(event: MouseEvent<HTMLDivElement>) {
    if (dialog !== null || !hasFinePointer()) return;
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "input, textarea, select, [data-slot='popover-trigger'], [data-slot='popover-content'], [data-slot='dropdown-menu-trigger'], [data-slot='dropdown-menu-content']",
      )
    )
      return;
    focusSearch();
  }

  /* ---------- الإدخال ---------- */

  function changeQuery(value: string) {
    setQuery(value);
    setActiveIndex(0);
    setNotFound(null);
  }

  function handleAdd(product: PosProduct, qty = 1) {
    cart.addProduct(product, qty);
    changeQuery("");
    focusSearch();
  }

  function submitEntry() {
    if (query.trim() === "") {
      if (!isEmpty) openPayment();
      return;
    }

    // "5*" لوحدها: ضبط كمية الصنف المحدد.
    if (entry.term === "") {
      if (entry.qty !== null && selectedId) cart.setQty(selectedId, entry.qty);
      changeQuery("");
      return;
    }

    const exact = POS_PRODUCTS.find((p) => p.barcode === entry.term);
    const product = exact ?? results[safeIndex];
    if (!product) {
      setNotFound(`مفيش صنف مطابق لـ «${entry.term}»`);
      searchRef.current?.select();
      return;
    }
    handleAdd(product, entry.qty ?? 1);
  }

  function handleRemove(id: string) {
    const line = cart.removeLine(id);
    if (!line) return;
    toast(`اتشال «${line.name}»`, {
      action: { label: "تراجع", onClick: cart.undoRemove },
      duration: 5000,
    });
    focusSearch();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const hasQuery = query !== "";
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        submitEntry();
        return;
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        if (searching && results.length > 0) {
          setActiveIndex(
            (safeIndex + direction + results.length) % results.length,
          );
        } else if (!hasQuery) {
          cart.moveSelection(direction);
        }
        return;
      }
      case "Escape":
        if (hasQuery) {
          event.preventDefault();
          changeQuery("");
        }
        return;
      case "Delete":
        if (!hasQuery && selectedId) {
          event.preventDefault();
          handleRemove(selectedId);
        }
        return;
      case "+":
      case "-":
        if (!hasQuery && selectedId) {
          event.preventDefault();
          cart.changeQty(selectedId, event.key === "+" ? 1 : -1);
        }
        return;
    }
  }

  /* ---------- النوافذ والإجراءات ---------- */

  function openPayment(method: PaymentMethod = "cash") {
    if (isEmpty) return;
    setPaymentMethod(method);
    setDialog("payment");
  }

  function openIfItems(name: "discount" | "cancel") {
    if (!isEmpty) setDialog(name);
  }

  function handleHold() {
    if (isEmpty) return;
    const { itemCount, total } = totals;
    cart.holdInvoice();
    changeQuery("");
    setMobileView("products");
    toast.success("اتعلّقت الفاتورة", {
      description: `${itemCount} صنف · ${formatMoneyText(total)}. هتلاقيها في المعلّقة (${POS_SHORTCUTS.heldList.label}).`,
    });
  }

  function handleRecall(id: string) {
    const result = cart.recallHeld(id);
    setDialog(null);
    setMobileView("cart");
    if (result?.swapped) toast.info("اتعلّقت الفاتورة الحالية تلقائي");
  }

  function handleCancelConfirm() {
    cart.cancelInvoice();
    changeQuery("");
    setDialog(null);
    setMobileView("products");
    toast("اتلغت الفاتورة");
  }

  function handleDiscountApply(discount: InvoiceDiscount) {
    cart.setDiscount(discount);
    setDialog(null);
  }

  function handleDiscountRemove() {
    cart.setDiscount(null);
    setDialog(null);
  }

  function pickCustomerFromPayment(method: PaymentMethod) {
    setPaymentMethod(method);
    setReopenPayment(true);
    setDialog("customer");
  }

  function handleCustomerSelect(customer: PosCustomer | null) {
    cart.setCustomer(customer);
    setDialog(reopenPayment ? "payment" : null);
    setReopenPayment(false);
  }

  function handleCustomerOpenChange(open: boolean) {
    if (open) return;
    setDialog(reopenPayment ? "payment" : null);
    setReopenPayment(false);
  }

  function handlePaymentConfirm(result: PaymentResult) {
    const customerName = invoice.customer?.name;
    const number = cart.completeInvoice();
    changeQuery("");
    setDialog(null);
    setMobileView("products");

    const description =
      result.change > 0
        ? `الباقي للعميل: ${formatMoneyText(result.change)}`
        : result.credit > 0
          ? `${formatMoneyText(result.credit)} آجل على ${customerName}`
          : `تم استلام ${formatMoneyText(result.cash)}`;
    toast.success(`تم حفظ الفاتورة #${number}`, {
      description,
      duration: result.change > 0 ? 10_000 : 4000,
    });
    // TODO: ابعت الفاتورة للـ API، وشغّل الطباعة لو result.print.
  }

  /* ---------- الاختصارات ---------- */

  const whenIdle = (fn: () => void) => () => {
    if (dialog === null) fn();
  };

  useHotkey(
    POS_SHORTCUTS.focusSearch.match,
    // eslint-disable-next-line react-hooks/refs
    whenIdle(() => {
      focusSearch(true);
      searchRef.current?.select();
    }),
  );
  useHotkey(
    POS_SHORTCUTS.heldList.match,
    whenIdle(() => setDialog("held")),
  );
  useHotkey(POS_SHORTCUTS.holdInvoice.match, whenIdle(handleHold));
  useHotkey(
    POS_SHORTCUTS.customer.match,
    whenIdle(() => setDialog("customer")),
  );
  useHotkey(
    POS_SHORTCUTS.cancelInvoice.match,
    whenIdle(() => openIfItems("cancel")),
  );
  useHotkey(
    POS_SHORTCUTS.discount.match,
    whenIdle(() => openIfItems("discount")),
  );
  useHotkey(
    POS_SHORTCUTS.pay.match,
    whenIdle(() => openPayment()),
  );
  useHotkey(
    POS_SHORTCUTS.help.match,
    whenIdle(() => setDialog("shortcuts")),
  );

  return (
    <div
      onClick={handleRootClick}
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
    >
      <PosTopBar
        heldCount={cart.held.length}
        onHeld={() => setDialog("held")}
        onShortcuts={() => setDialog("shortcuts")}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <PosProductPane
          className={cn("flex", mobileView === "cart" && "hidden lg:flex")}
          inputRef={searchRef}
          query={query}
          onQueryChange={changeQuery}
          onSearchKeyDown={handleSearchKeyDown}
          notFound={notFound}
          pendingQty={entry.qty}
          searchTerm={entry.term}
          results={results}
          activeIndex={safeIndex}
          onActiveIndexChange={setActiveIndex}
          products={POS_PRODUCTS}
          categories={POS_CATEGORIES}
          category={category}
          onCategoryChange={setCategory}
          onAdd={(product) => handleAdd(product)}
        />

        <PosCartPanel
          className={cn("flex", mobileView === "products" && "hidden lg:flex")}
          invoice={invoice}
          totals={totals}
          selectedId={selectedId}
          onSelect={cart.selectLine}
          onSetQty={cart.setQty}
          onStep={cart.changeQty}
          onRemove={handleRemove}
          onFocusSearch={() => focusSearch()}
          onCustomer={() => setDialog("customer")}
          onCancel={() => openIfItems("cancel")}
          onBack={() => setMobileView("products")}
          onHold={handleHold}
          onDiscount={() => openIfItems("discount")}
          onRemoveDiscount={() => cart.setDiscount(null)}
          onPay={() => openPayment()}
        />
      </div>

      {mobileView === "products" && (
        <div className="flex shrink-0 items-center gap-3 border-t bg-background p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {totals.itemCount} صنف
            </p>
            <Money amount={totals.total} className="text-2xl leading-none" />
          </div>
          <Button
            type="button"
            size="lg"
            className="h-11 px-5 text-sm"
            onClick={() => setMobileView("cart")}
          >
            عرض الفاتورة
          </Button>
        </div>
      )}

      <PosPaymentDialog
        open={dialog === "payment"}
        onOpenChange={(open) => !open && setDialog(null)}
        total={totals.total}
        customer={invoice.customer}
        initialMethod={paymentMethod}
        onPickCustomer={pickCustomerFromPayment}
        onConfirm={handlePaymentConfirm}
      />
      <PosDiscountDialog
        open={dialog === "discount"}
        onOpenChange={(open) => !open && setDialog(null)}
        subtotal={totals.subtotal}
        current={invoice.discount}
        onApply={handleDiscountApply}
        onRemove={handleDiscountRemove}
      />
      <PosCustomerDialog
        open={dialog === "customer"}
        onOpenChange={handleCustomerOpenChange}
        customers={POS_CUSTOMERS}
        selectedId={invoice.customer?.id ?? null}
        onSelect={handleCustomerSelect}
      />
      <PosHeldDialog
        open={dialog === "held"}
        onOpenChange={(open) => !open && setDialog(null)}
        held={cart.held}
        currentHasItems={!isEmpty}
        onRecall={handleRecall}
      />
      <PosCancelDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => !open && setDialog(null)}
        itemCount={totals.itemCount}
        total={totals.total}
        onConfirm={handleCancelConfirm}
      />
      <PosShortcutsDialog
        open={dialog === "shortcuts"}
        onOpenChange={(open) => !open && setDialog(null)}
      />
    </div>
  );
}
