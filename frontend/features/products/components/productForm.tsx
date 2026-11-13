"use client";

import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useHotkey } from "@/hooks/useHotkey";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import { PRODUCT_FORM_SHORTCUTS } from "../config/productShortcuts";
import { useProductFormFields } from "../hooks/useProductFormFields";
import { focusFirstError } from "../lib/productFormFocus";
import { ProductFormAside } from "./productFormAside";
import { ProductFormBasics } from "./productFormBasics";
import { ProductFormFooter, type SaveAction } from "./productFormFooter";
import { ProductFormPricing } from "./productFormPricing";
import { ProductFormStock } from "./productFormStock";
import { ProductFormUnits } from "./productFormUnits";

function ProductFormHeader({ isEditing }: { isEditing: boolean }) {
  const { form } = useProductFormFields();
  const name = useWatch({ control: form.control, name: "name" });
  const dirty = form.formState.isDirty;
  return (
    <header className="flex items-start gap-3">
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="رجوع إلى المنتجات"
        nativeButton={false}
        render={<Link href={PRODUCT_ROUTES.list} />}
        className="mt-0.5 shrink-0"
      >
        <IconArrowRight />
      </Button>
      <div className="min-w-0 space-y-0.5">
        <h1 className="truncate text-lg font-bold">
          {isEditing ? `تعديل: ${name || "صنف"}` : "صنف جديد"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {isEditing
            ? dirty
              ? "توجد تعديلات لم تُحفظ بعد."
              : "عدّل ما تحتاجه ثم احفظ."
            : "المطلوب فقط: اسم الصنف وسعر البيع. والباقي اختياري ويمكنك إكماله لاحقاً."}
        </p>
      </div>
    </header>
  );
}

/** نموذج إضافة/تعديل صنف: النموذج + لوحة جانبية (معاينة وربح واكتمال). */
export function ProductForm() {
  const { form, onSubmit, isSaving, isEditing } = useProductFormFields();
  const [pendingAction, setPendingAction] = useState<SaveAction>("save");

  function submit(andNew: boolean) {
    if (isSaving) return;
    setPendingAction(andNew ? "saveAndNew" : "save");
    void form.handleSubmit(
      (data) => onSubmit(data, andNew),
      (errors) => {
        focusFirstError(errors);
        toast.error("راجع الحقول المظللة بالأحمر");
      },
    )();
  }

  useHotkey(PRODUCT_FORM_SHORTCUTS.save.match, () => submit(false));
  useHotkey(PRODUCT_FORM_SHORTCUTS.saveAndNew.match, () => submit(true));

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
      className="mx-auto flex max-w-6xl flex-col gap-4"
    >
      <ProductFormHeader isEditing={isEditing} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <ProductFormBasics />
          <ProductFormPricing />
          <ProductFormStock />
          <ProductFormUnits />
        </div>
        <ProductFormAside />
      </div>

      <ProductFormFooter
        isEditing={isEditing}
        isSaving={isSaving}
        pendingAction={pendingAction}
        onSaveAndNew={() => submit(true)}
      />
    </form>
  );
}
