import { fetchCustomers } from "@/features/customers/api/customers.api";
import {
  getCategories,
  getProducts,
} from "@/features/products/api/products.api";
import type { Customer } from "@/features/customers/types/customer";
import { fetchSales } from "@/features/sales/api/sales.api";
import type { Sale } from "@/features/sales/types/sale";
import type { Product } from "@/features/products/types/product";

import type { CompletedInvoice, PosCustomer, PosProduct } from "../types/pos";
import type { CatalogState } from "../store/catalogSlice";

const PAGE_SIZE = 200;
/** آخر فواتير تظهر في نافذة المرتجع (الـ backend يقصرها للكاشير على مهلة الإرجاع). */
const RECENT_INVOICES = 200;

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

/** فاتورة من الـ backend → شكل الكاشير. نسبة الخصم للعرض فقط؛ قيمة المرتجع يحسبها السيرفر. */
export function toCompletedInvoice(sale: Sale): CompletedInvoice {
  const gross = sale.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  return {
    id: sale.id,
    number: sale.number,
    soldAt: sale.soldAt,
    customer: sale.customerId
      ? {
          id: sale.customerId,
          name: sale.customerName ?? "",
          phone: sale.customerPhone ?? "",
          balance: 0,
          creditLimit: 0,
        }
      : null,
    discountRate:
      gross > 0 ? Math.min(Math.max(1 - sale.total / gross, 0), 1) : 0,
    lines: sale.lines.map((l) => ({
      lineId: l.id,
      productId: l.productId,
      name: l.name,
      barcode: "",
      unit: l.unitName,
      price: l.unitPrice,
      qty: l.qty,
      returnedQty: l.returnedQty,
      allowDecimal: !Number.isInteger(l.qty),
    })),
  };
}

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
  Pick<CatalogState, "products" | "categories" | "customers" | "invoices"> & {
    nextNumber: number;
  }
> {
  const [products, categories, customers, sales] = await Promise.all([
    fetchAllProducts(),
    getCategories(),
    fetchCustomers(),
    fetchSales({ page: 1, pageSize: RECENT_INVOICES, sort: "newest" }),
  ]);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const invoices = sales.items.map(toCompletedInvoice).map((inv) => ({
    ...inv,
    lines: inv.lines.map((l) => ({
      ...l,
      barcode: productMap.get(l.productId)?.barcode ?? "",
      allowDecimal: productMap.get(l.productId)?.allowDecimal ?? l.allowDecimal,
    })),
  }));
  return {
    products: products.filter((p) => p.isActive).map(toPosProduct),
    categories,
    customers: customers.filter((c) => c.isActive).map(toPosCustomer),
    invoices,
    nextNumber: (sales.items[0]?.number ?? 0) + 1,
  };
}

/** الأصناف فقط (بعد تغيّر سعر أثناء البيع). */
export async function fetchPosProducts(): Promise<PosProduct[]> {
  return (await fetchAllProducts()).filter((p) => p.isActive).map(toPosProduct);
}
