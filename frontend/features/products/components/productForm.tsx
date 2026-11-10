"use client";

import { useState } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormSection, SwitchField } from "@/components/shared/form";
import { useHotkey } from "@/hooks/useHotkey";

import { PRODUCT_FIELD_IDS as IDS } from "../config/productFormFields";
import { PRODUCT_FORM_SHORTCUTS } from "../config/productShortcuts";
import { useProductFormFields } from "../hooks/useProductFormFields";
import { focusFirstError } from "../lib/productFormFocus";
import { ProductFormBasics } from "./productFormBasics";
import { ProductFormFooter, type SaveAction } from "./productFormFooter";
import { ProductFormPricing } from "./productFormPricing";
import { ProductFormStock } from "./productFormStock";
import { ProductFormUnits } from "./productFormUnits";

function ProductFormHeader({ isEditing }: { isEditing: boolean }) {
  return (
    <header className="space-y-1">
      <h1 className="text-lg font-bold">
        {isEditing ? "تعديل صنف" : "صنف جديد"}
      </h1>
      <p className="text-xs text-muted-foreground">
        {isEditing
          ? "عدّل بيانات الصنف ثم احفظ."
          : "اسم الصنف وسعر البيع فقط هما المطلوبان."}
      </p>
    </header>
  );
}

function ProductActiveSwitch() {
  const { form, setField } = useProductFormFields();
  const isActive = useWatch({ control: form.control, name: "isActive" });
  return (
    <FormSection>
      <SwitchField
        id={IDS.isActive}
        label="مفعّل في الكاشير"
        description="الصنف المعطّل لا يظهر في شاشة البيع."
        checked={isActive}
        onCheckedChange={(checked) => setField("isActive", checked)}
      />
    </FormSection>
  );
}

/** نموذج إضافة/تعديل صنف. كل قسم في ملفه ويقرأ النموذج من ProductFormContext. */
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
        toast.error("راجع الحقول المطلوبة");
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
      className="mx-auto flex max-w-3xl flex-col gap-5"
    >
      <ProductFormHeader isEditing={isEditing} />
      <ProductFormBasics />
      <ProductFormPricing />
      <ProductFormStock />
      <ProductFormUnits />
      <ProductActiveSwitch />
      <ProductFormFooter
        isEditing={isEditing}
        isSaving={isSaving}
        pendingAction={pendingAction}
        onSaveAndNew={() => submit(true)}
      />
    </form>
  );
}
