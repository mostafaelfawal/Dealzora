import { fetchCustomers } from "@/features/customers/api/customers.api";
import {
  getCategories,
  getProducts,
} from "@/features/products/api/products.api";
import type { Customer } from "@/features/customers/types/customer";
import type { Product } from "@/features/products/types/product";

import type { PosCustomer, PosProduct } from "../types/pos";
import type { CatalogState } from "../store/catalogSlice";

const PAGE_SIZE = 200;

const toPosProduct = (p: Product): PosProduct => ({
  id: p.id,
  name: p.name,
  barcode: p.barcode,
  category: p.category,
  price: p.salePrice,
  unit: p.unit,
  allowDecimal: p.allowDecimal,
  stock: p.stock,
  minStock: p.minStock,
});

const toPosCustomer = (c: Customer): PosCustomer => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  balance: c.balance,
  creditLimit: c.creditLimit,
});

/** يجلب كل الأصناف صفحة صفحة. نعتمد على page_size الراجع من السيرفر لو قصّه. */
async function fetchAllProducts(): Promise<Product[]> {
  const params = { page_size: PAGE_SIZE, sort: "name_asc" } as const;
  const first = await getProducts({ ...params, page: 1 });
  const items = [...first.items];
  const pages = Math.ceil(first.total / Math.max(first.pageSize, 1));
  for (let page = 2; page <= pages; page++) {
    items.push(...(await getProducts({ ...params, page })).items);
  }
  return items;
}

export async function fetchPosCatalog(): Promise<
  Pick<CatalogState, "products" | "categories" | "customers">
> {
  const [products, categories, customers] = await Promise.all([
    fetchAllProducts(),
    getCategories(),
    fetchCustomers(),
  ]);
  return {
    products: products.filter((p) => p.isActive).map(toPosProduct),
    categories,
    customers: customers.filter((c) => c.isActive).map(toPosCustomer),
  };
}
