import { toast } from "sonner";

import { createExchange, createSale } from "@/features/sales/api/sales.api";
import { printReceipt, sendWhatsapp } from "@/features/sales/lib/receipt";
import type { Sale, SaleInput } from "@/features/sales/types/sale";
import { fetchShopName } from "@/features/settings/api/settings.api";
import { newClientRef } from "@/lib/apiMap";
import { ApiError } from "@/lib/axios";
import { extractErrorMessage } from "@/lib/errors";
import { formatItemCount, formatMoneyText } from "@/lib/format";
import type { AppThunk, RootState } from "@/lib/store";
import { fetchPosProducts, toCompletedInvoice } from "../api/posCatalog.api";
import { lineDiscount } from "../lib/posCalc";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import { focusSearch, selectSearchText } from "../lib/posFocus";
import type {
  InvoiceDiscount,
  PaymentMethod,
  PaymentResult,
  PosCustomer,
  PosProduct,
} from "../types/pos";
import { cartActions } from "./cartSlice";
import { posUiActions } from "./posUiSlice";
import {
  selectCanRedo,
  selectCanUndo,
  selectEntry,
  selectHeld,
  selectIsEmpty,
  selectIsSearching,
  selectLines,
  selectProducts,
  selectSafeIndex,
  selectSearchResults,
  selectSelectedId,
  selectTotals,
} from "./selectors";
import { catalogActions } from "./catalogSlice";
import { exchangeActions } from "./exchangeSlice";
import type { ExchangeDraft } from "../types/pos";
import { selectExchange } from "./selectors";

/*
 * الـ thunks هنا بتجمع أكتر من خطوة (قراءة state + dispatch + toast + تركيز).
 * المكوّنات بتنادي thunk واحد بدل ما تعيد المنطق ده.
 */

/* ---------- الأصناف ---------- */

export const addToCart =
  (product: PosProduct, qty = 1): AppThunk =>
  (dispatch) => {
    dispatch(cartActions.addProduct({ product, qty }));
    focusSearch();
  };

export const removeLineWithUndo =
  (id: string): AppThunk =>
  (dispatch, getState) => {
    const line = selectLines(getState()).find((l) => l.productId === id);
    if (!line) return;
    dispatch(cartActions.removeLine(id));
    toast(`أُزيل «${line.name}»`, {
      action: {
        label: "تراجع",
        onClick: () => dispatch(cartActions.undoRemove()),
      },
      duration: 5000,
    });
    focusSearch();
  };

/* ---------- خانة الباركود ---------- */

/** Enter في خانة الباركود. */
export const submitEntry = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const entry = selectEntry(state);

  // خانة فاضية: ادفع.
  if (state.posUi.query.trim() === "") {
    if (!selectIsEmpty(state) || selectExchange(state))
      dispatch(requestPayment());
    return;
  }

  // "5*" وحدها: ضبط كمية الصنف المحدد.
  if (entry.term === "") {
    const selectedId = selectSelectedId(state);
    if (entry.qty !== null && selectedId) {
      dispatch(cartActions.setQty({ id: selectedId, qty: entry.qty }));
    }
    dispatch(posUiActions.setQuery(""));
    return;
  }

  const exact = selectProducts(state).find((p) => p.barcode === entry.term);
  const product = exact ?? selectSearchResults(state)[selectSafeIndex(state)];
  if (!product) {
    dispatch(posUiActions.setNotFound(`لا يوجد صنف مطابق لـ «${entry.term}»`));
    selectSearchText();
    return;
  }
  dispatch(addToCart(product, entry.qty ?? 1));
};

/** مفاتيح خانة الباركود. بترجّع true لو اتعاملنا مع المفتاح (يعني اعمل preventDefault). */
export const handleSearchKey =
  (key: string): AppThunk<boolean> =>
  (dispatch, getState) => {
    const state = getState();
    const hasQuery = state.posUi.query !== "";
    const selectedId = selectSelectedId(state);

    switch (key) {
      case "Enter":
        dispatch(submitEntry());
        return true;

      case "ArrowDown":
      case "ArrowUp": {
        const direction = key === "ArrowDown" ? 1 : -1;
        const results = selectSearchResults(state);
        if (selectIsSearching(state) && results.length > 0) {
          const next =
            (selectSafeIndex(state) + direction + results.length) %
            results.length;
          dispatch(posUiActions.setActiveIndex(next));
        } else if (!hasQuery) {
          dispatch(cartActions.moveSelection(direction));
        }
        return true;
      }

      case "Escape":
        if (!hasQuery) return false;
        dispatch(posUiActions.setQuery(""));
        return true;

      case "Delete":
        if (hasQuery || !selectedId) return false;
        dispatch(removeLineWithUndo(selectedId));
        return true;

      case "+":
      case "-":
        if (hasQuery || !selectedId) return false;
        dispatch(
          cartActions.changeQty({
            id: selectedId,
            direction: key === "+" ? 1 : -1,
          }),
        );
        return true;
    }
    return false;
  };

/* ---------- النوافذ ---------- */

/** تفتح الخصم أو الإلغاء بس لو في أصناف. */
export const requestDialog =
  (name: "discount" | "cancel"): AppThunk =>
  (dispatch, getState) => {
    if (!selectIsEmpty(getState())) dispatch(posUiActions.openDialog(name));
  };

export const requestPayment =
  (method: PaymentMethod = "cash"): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    // أثناء الاستبدال: التسوية بدل الدفع العادي.
    if (selectExchange(state)) {
      dispatch(posUiActions.openDialog("exchange"));
      return;
    }
    if (!selectIsEmpty(state)) dispatch(posUiActions.openPayment(method));
  };

/* ---------- تعليق / استرجاع / إلغاء ---------- */

export const holdCurrentInvoice = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  if (selectExchange(state)) {
    toast.error("أنهِ الاستبدال أو ألغِه أولاً");
    return;
  }
  if (selectIsEmpty(state)) return;
  const { itemCount, total } = selectTotals(state);
  dispatch(cartActions.holdInvoice());
  toast.success("عُلّقت الفاتورة", {
    description: `${formatItemCount(itemCount)} · ${formatMoneyText(total)}. ستجدها في المعلّقة (${POS_SHORTCUTS.heldList.label}).`,
  });
};

export const requestReturn = (): AppThunk => (dispatch, getState) => {
  if (selectExchange(getState())) {
    toast.error("أنهِ الاستبدال الحالي أو ألغِه أولاً");
    return;
  }
  dispatch(posUiActions.openDialog("returnPicker"));
};

export const recallHeldInvoice =
  (id: string): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    if (selectExchange(state)) {
      toast.error("أنهِ الاستبدال أو ألغِه أولاً");
      return;
    }
    if (!selectHeld(state).some((h) => h.id === id)) return;
    const swapped = !selectIsEmpty(state);
    dispatch(cartActions.recallHeld(id));
    if (swapped) toast.info("عُلّقت الفاتورة الحالية تلقائياً");
  };

export const confirmCancel = (): AppThunk => (dispatch) => {
  dispatch(cartActions.cancelInvoice());
  toast("أُلغيت الفاتورة");
};

/* ---------- خصم / عميل / دفع ---------- */

/** تطبيق الخصم (أو إزالته بـ null) على الفاتورة أو الصنف المحدد حسب هدف النافذة. */
export const applyDiscount =
  (discount: InvoiceDiscount | null): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    if (state.posUi.discountTarget === "line") {
      const id = selectSelectedId(state);
      if (id) {
        // خصم الصنف يُحفظ كمبلغ ثابت (النسبة تُحوَّل لمبلغ في النافذة).
        dispatch(
          cartActions.setLineDiscount({ id, amount: discount?.value ?? 0 }),
        );
      }
    } else {
      dispatch(cartActions.setDiscount(discount));
    }
    dispatch(posUiActions.closeDialog());
  };

/** F5: خصم على الصنف المحدد (يلزم وجود صنف). */
export const requestLineDiscount = (): AppThunk => (dispatch, getState) => {
  if (selectSelectedId(getState())) dispatch(posUiActions.openLineDiscount());
};

export const selectCustomer =
  (customer: PosCustomer | null): AppThunk =>
  (dispatch) => {
    dispatch(cartActions.setCustomer(customer));
    dispatch(posUiActions.closeCustomerDialog());
  };

/* ---------- الحفظ في الـ backend ---------- */

let shopNameCache: string | null = null;
async function shopName(): Promise<string> {
  if (shopNameCache) return shopNameCache;
  try {
    shopNameCache = (await fetchShopName()) ?? "Dealzora";
  } catch {
    return "Dealzora";
  }
  return shopNameCache;
}

/** سطور الفاتورة الحالية بالشكل الذي يتوقعه الـ backend. */
function buildSaleInput(
  state: RootState,
  payment: Pick<SaleInput, "paymentMethod" | "cashAmount" | "received">,
): SaleInput {
  const invoice = state.cart.present;
  return {
    clientRef: newClientRef(),
    customerId: invoice.customer?.id ?? null,
    lines: invoice.lines.map((l) => ({
      productId: l.productId,
      qty: l.qty,
      unitPrice: l.price,
      discount: lineDiscount(l),
    })),
    invoiceDiscount: selectTotals(state).discountAmount,
    ...payment,
  };
}

/** أخطاء الحفظ برسالة واضحة، وتحديث الأسعار تلقائياً لو تغيّرت. */
const handleSaveError =
  (error: unknown, fallback: string): AppThunk =>
  (dispatch) => {
    const details = error instanceof ApiError ? error.details : null;
    const product =
      typeof details?.product === "string" ? details.product : null;
    toast.error(extractErrorMessage(error, fallback), {
      description: product ? "الصنف: " + product : undefined,
      duration: 8000,
    });
    if (error instanceof ApiError && error.code === "sale_price_changed") {
      void fetchPosProducts()
        .then((products) => dispatch(catalogActions.setCatalog({ products })))
        .catch(() => undefined);
    }
  };

/** بعد الحفظ: الفاتورة تدخل قائمة المرتجع، والرصيد ودين العميل يتحدثان محلياً. */
const recordSaved =
  (sale: Sale): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const cartLines = state.cart.present.lines;
    const invoice = toCompletedInvoice(sale);
    invoice.lines = invoice.lines.map((l) => {
      const cartLine = cartLines.find((c) => c.productId === l.productId);
      return cartLine
        ? {
            ...l,
            barcode: cartLine.barcode,
            allowDecimal: cartLine.allowDecimal,
          }
        : l;
    });
    dispatch(catalogActions.addInvoice(invoice));
    if (sale.customerId && sale.creditAmount > 0) {
      dispatch(
        catalogActions.setCatalog({
          customers: state.catalog.customers.map((c) =>
            c.id === sale.customerId
              ? {
                  ...c,
                  balance:
                    Math.round((c.balance + sale.creditAmount) * 100) / 100,
                }
              : c,
          ),
        }),
      );
    }
  };

export const confirmPayment =
  (result: PaymentResult): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const state = getState();
    if (state.posUi.saving || selectIsEmpty(state)) return;
    const input = buildSaleInput(state, {
      paymentMethod: result.method,
      cashAmount: result.cash,
      received: result.method === "cash" ? result.received : result.cash,
    });

    dispatch(posUiActions.setSaving(true));
    try {
      const sale = await createSale(input);
      dispatch(recordSaved(sale));
      dispatch(cartActions.completeInvoice(sale.number));

      const name = await shopName();
      if (result.print) printReceipt(sale, name);

      const description =
        sale.change > 0
          ? "الباقي للعميل: " + formatMoneyText(sale.change)
          : sale.creditAmount > 0
            ? formatMoneyText(sale.creditAmount) +
              " آجل على " +
              (sale.customerName ?? "العميل")
            : "تم استلام " + formatMoneyText(sale.cashAmount);
      toast.success("تم حفظ الفاتورة #" + sale.number, {
        description,
        duration: sale.change > 0 ? 10_000 : 5000,
        action: {
          label: "واتساب",
          onClick: () =>
            void sendWhatsapp(sale, name, sale.customerPhone).catch(() =>
              toast.error("تعذّر فتح واتساب"),
            ),
        },
      });
    } catch (error) {
      dispatch(
        handleSaveError(
          error,
          "تعذّر حفظ الفاتورة. الفاتورة ما زالت مفتوحة، أعد المحاولة",
        ),
      );
    } finally {
      dispatch(posUiActions.setSaving(false));
      focusSearch();
    }
  };

/* ---------- تراجع / إعادة ---------- */

const HISTORY_TOAST = { id: "pos-history", duration: 1500 } as const;

export const undoInvoice = (): AppThunk => (dispatch, getState) => {
  if (!selectCanUndo(getState())) {
    toast("لا يوجد ما يمكن التراجع عنه", HISTORY_TOAST);
    return;
  }
  dispatch(cartActions.undo());
  toast("تم التراجع عن آخر تعديل", HISTORY_TOAST);
};

export const redoInvoice = (): AppThunk => (dispatch, getState) => {
  if (!selectCanRedo(getState())) {
    toast("لا يوجد ما يمكن إعادته", HISTORY_TOAST);
    return;
  }
  dispatch(cartActions.redo());
  toast("تمت إعادة التعديل", HISTORY_TOAST);
};
/* ---------- الاستبدال / المرتجع ---------- */

export const openReturn =
  (invoiceId: string): AppThunk =>
  (dispatch) => {
    dispatch(exchangeActions.setPending(invoiceId));
    dispatch(posUiActions.openDialog("return"));
  };

/**
 * mode = "exchange": نقفل النافذة ونترك الكاشير يضيف الأصناف الجديدة.
 * mode = "returnOnly": نفتح التسوية فوراً.
 */
export const startExchange =
  (draft: ExchangeDraft, mode: "exchange" | "returnOnly"): AppThunk =>
  (dispatch) => {
    dispatch(exchangeActions.start(draft));
    if (mode === "returnOnly") {
      dispatch(posUiActions.openDialog("exchange"));
      return;
    }
    dispatch(posUiActions.closeDialog());
    dispatch(posUiActions.setMobileView("products"));
    toast.info("أضف الأصناف الجديدة ثم اضغط تسوية", {
      description: `استبدال من فاتورة #${draft.invoiceNumber}`,
    });
    focusSearch();
  };

export const cancelExchange = (): AppThunk => (dispatch) => {
  dispatch(exchangeActions.clear());
  toast("أُلغي الاستبدال");
  focusSearch();
};

export const confirmExchange =
  (print = true): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const state = getState();
    const draft = selectExchange(state);
    if (!draft || state.posUi.saving) return;

    const hasNewItems = !selectIsEmpty(state);
    const total = selectTotals(state).total;
    const saleInput = hasNewItems
      ? buildSaleInput(state, {
          paymentMethod: "cash",
          cashAmount: total,
          received: total,
        })
      : null;

    dispatch(posUiActions.setSaving(true));
    try {
      const { saleReturn, sale } = await createExchange(
        draft.invoiceId,
        {
          reason: draft.reason,
          lines: draft.lines.map((l) => ({ saleLineId: l.lineId, qty: l.qty })),
        },
        saleInput,
      );
      dispatch(
        catalogActions.applyReturn({
          invoiceId: draft.invoiceId,
          lines: draft.lines.map((l) => ({
            productId: l.productId,
            qty: l.qty,
          })),
        }),
      );
      if (sale) {
        dispatch(recordSaved(sale));
        dispatch(cartActions.completeInvoice(sale.number));
        if (print) printReceipt(sale, await shopName());
      } else dispatch(posUiActions.closeDialog());
      dispatch(exchangeActions.clear());

      const net =
        Math.round(((sale?.total ?? 0) - saleReturn.total) * 100) / 100;
      const amount = formatMoneyText(Math.abs(net));
      toast.success(
        sale
          ? "تم الاستبدال (فاتورة #" + sale.number + ")"
          : "تم تسجيل المرتجع #" +
              saleReturn.number +
              " من فاتورة #" +
              draft.invoiceNumber,
        {
          description:
            net > 0
              ? "استلم " + amount + " من العميل"
              : net < 0
                ? "رُدّ للعميل " + amount + " من الدرج"
                : "بدون فرق مالي",
          duration: net < 0 ? 10_000 : 5000,
        },
      );
    } catch (error) {
      dispatch(handleSaveError(error, "تعذّر حفظ الاستبدال"));
    } finally {
      dispatch(posUiActions.setSaving(false));
      focusSearch();
    }
  };
