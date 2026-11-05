import { normalizeDigits } from "@/lib/format";

import type { SupplierSchemaType } from "../schema/supplier.schema";
import type {
  SupplierCreatePayload,
  SupplierUpdatePayload,
} from "../types/supplierApi";
import { parseNumber } from "./supplierCalc";
import { MONEY_SCALE } from "./supplierMapper";

const scaled = (text: string) => {
  const value = parseNumber(text);
  return Number.isFinite(value) ? Math.round(value * MONEY_SCALE) : 0;
};

const orNull = (text: string) => text.trim() || null;
const cleanPhone = (text: string) =>
  orNull(normalizeDigits(text).replace(/[\s-]/g, ""));

function toBase(v: SupplierSchemaType) {
  return {
    name: v.name.split(/\s+/).filter(Boolean).join(" "),
    phone: cleanPhone(v.phone),
    address: orNull(v.address),
    notes: orNull(v.notes),
    is_active: v.isActive,
  };
}

export const toCreatePayload = (
  v: SupplierSchemaType,
): SupplierCreatePayload => ({
  ...toBase(v),
  opening_balance: scaled(v.openingBalance),
});

export const toUpdatePayload = (
  v: SupplierSchemaType,
  baseVersion: number,
): SupplierUpdatePayload => ({ ...toBase(v), base_version: baseVersion });
