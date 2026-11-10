import { useCallback } from "react";
import type { Path, PathValue } from "react-hook-form";

import { useProductFormContext } from "../context/ProductFormContext";
import type { ProductSchemaType } from "../schema/product.schema";

/**
 * وصول موحّد لنموذج الصنف من أي قسم:
 * setField يعلّم الحقل كمعدّل، ويعيد التحقق فقط بعد أول محاولة حفظ.
 */
export function useProductFormFields() {
  const ctx = useProductFormContext();
  const {
    setValue,
    formState: { isSubmitted },
  } = ctx.form;

  const setField = useCallback(
    <P extends Path<ProductSchemaType>>(
      name: P,
      value: PathValue<ProductSchemaType, P>,
    ) => {
      setValue(name, value, { shouldDirty: true, shouldValidate: isSubmitted });
    },
    [setValue, isSubmitted],
  );

  return { ...ctx, setField, isEditing: Boolean(ctx.productId) };
}
