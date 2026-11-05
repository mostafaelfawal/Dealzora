import type { Customer, CustomerInput } from "../types/customer";
import type { CustomerSchemaType } from "../schema/customer.schema";
import { amountOrZero, cleanName, cleanPhone, parseAmount } from "./customerCalc";

export const EMPTY_CUSTOMER_FORM: CustomerSchemaType = {
  name: "",
  phone: "",
  address: "",
  notes: "",
  creditLimit: "",
  openingBalance: "",
  isActive: true,
};

export const customerToForm = (c: Customer): CustomerSchemaType => ({
  name: c.name,
  phone: c.phone,
  address: c.address,
  notes: c.notes,
  creditLimit: c.creditLimit ? String(c.creditLimit) : "",
  openingBalance: "",
  isActive: c.isActive,
});

export const formToInput = (v: CustomerSchemaType): CustomerInput => ({
  name: cleanName(v.name),
  phone: cleanPhone(v.phone),
  address: v.address.trim(),
  notes: v.notes.trim(),
  creditLimit: amountOrZero(parseAmount(v.creditLimit)),
  openingBalance: amountOrZero(parseAmount(v.openingBalance)),
  isActive: v.isActive,
});
