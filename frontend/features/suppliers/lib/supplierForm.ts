import type { SupplierSchemaType } from "../schema/supplier.schema";
import type { Supplier } from "../types/supplier";

export const emptyValues = (): SupplierSchemaType => ({
  name: "",
  phone: "",
  address: "",
  notes: "",
  openingBalance: "",
  isActive: true,
});

export function toFormValues(supplier?: Supplier): SupplierSchemaType {
  if (!supplier) return emptyValues();
  return {
    name: supplier.name,
    phone: supplier.phone,
    address: supplier.address,
    notes: supplier.notes,
    openingBalance: "",
    isActive: supplier.isActive,
  };
}
