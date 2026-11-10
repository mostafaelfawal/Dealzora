import type { FieldErrors } from "react-hook-form";

import {
  PRODUCT_ERROR_ORDER,
  PRODUCT_FIELD_IDS,
  UNIT_KEYS,
  unitFieldId,
  type UnitKey,
} from "../config/productFormFields";
import type { ProductSchemaType } from "../schema/product.schema";

export const focusById = (id: string) => document.getElementById(id)?.focus();

type UnitRowErrors = Array<Partial<Record<UnitKey, unknown>> | undefined>;

/** يركّز على أول حقل خاطئ بترتيب ظهوره، بما فيها صفوف الوحدات الإضافية. */
export function focusFirstError(errors: FieldErrors<ProductSchemaType>) {
  const field = PRODUCT_ERROR_ORDER.find((f) => errors[f]);
  if (!field) return;

  if (field !== "extraUnits") {
    focusById(PRODUCT_FIELD_IDS[field]);
    return;
  }

  const rows = errors.extraUnits as unknown as UnitRowErrors | undefined;
  const index = Array.isArray(rows) ? rows.findIndex(Boolean) : -1;
  const key =
    index >= 0 ? (UNIT_KEYS.find((k) => rows?.[index]?.[k]) ?? "name") : "name";
  focusById(unitFieldId(key, Math.max(index, 0)));
}
