import { toast } from "sonner";

import { formatItemCount, formatMoneyText } from "@/lib/format";
import type { AppThunk } from "@/lib/store";
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
import { selectExchange, selectSettlement } from "./selectors";

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
  dispatch(posUiActions.openDialog("returnPicker"))
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

/** تطبيق الخصم (أو إزالته بـ null) وإغلاق النافذة. */
export const applyDiscount =
  (discount: InvoiceDiscount | null): AppThunk =>
  (dispatch) => {
    dispatch(cartActions.setDiscount(discount));
    dispatch(posUiActions.closeDialog());
  };

export const selectCustomer =
  (customer: PosCustomer | null): AppThunk =>
  (dispatch) => {
    dispatch(cartActions.setCustomer(customer));
    dispatch(posUiActions.closeCustomerDialog());
  };

export const confirmPayment =
  (result: PaymentResult): AppThunk =>
  (dispatch, getState) => {
    const state = getState();
    const customerName = state.cart.present.customer?.name;
    const number = state.cart.nextNumber;

    dispatch(cartActions.completeInvoice());

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
    // TODO: أرسل الفاتورة إلى الـ API، وشغّل الطباعة إن كانت result.print مفعّلة.
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

export const confirmExchange = (): AppThunk => (dispatch, getState) => {
  const state = getState();
  const draft = selectExchange(state);
  if (!draft) return;

  const { net, kind } = selectSettlement(state);
  const hasNewItems = !selectIsEmpty(state);
  const number = state.cart.nextNumber;

  // TODO: إرسال (مرتجع + فاتورة جديدة + حركة المخزون + حركة الدرج) للـ API في معاملة واحدة.
  dispatch(
    catalogActions.applyReturn({
      invoiceId: draft.invoiceId,
      lines: draft.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
    }),
  );
  if (hasNewItems) dispatch(cartActions.completeInvoice());
  else dispatch(posUiActions.closeDialog());
  dispatch(exchangeActions.clear());

  const amount = formatMoneyText(Math.abs(net));
  toast.success(
    hasNewItems
      ? `تم الاستبدال (فاتورة #${number})`
      : `تم تسجيل المرتجع من فاتورة #${draft.invoiceNumber}`,
    {
      description:
        kind === "collect"
          ? `استلم ${amount} من العميل`
          : kind === "refund"
            ? `رُدّ للعميل ${amount} من الدرج`
            : "بدون فرق مالي",
      duration: kind === "refund" ? 10_000 : 4000,
    },
  );
};
