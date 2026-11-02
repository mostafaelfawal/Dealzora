import { round2 } from "@/features/pos/lib/posCalc";
import { POS_CATEGORIES, POS_PRODUCTS } from "@/features/pos/mocks/posData";
import type { Product } from "../types/product";

/** TODO: تأتي من قاعدة البيانات المحلية (IndexedDB) وتتزامن مع الـ API. */
export const PRODUCT_CATEGORIES = POS_CATEGORIES;

/** نعيد استخدام بيانات الكاشير ونضيف عليها سعر الشراء والحالة. */
export const PRODUCTS: Product[] = POS_PRODUCTS.map((p) => ({
  id: p.id,
  name: p.name,
  barcode: p.barcode,
  category: p.category,
  unit: p.unit,
  allowDecimal: p.allowDecimal,
  costPrice: round2(p.price * 0.8),
  salePrice: p.price,
  stock: p.stock,
  minStock: p.minStock,
  isActive: p.id !== "p11",
  extraUnits:
    p.id === "p09"
      ? [
          {
            id: "u-p09-carton",
            name: "كرتونة",
            factor: 6,
            barcode: "6221002000100",
            salePrice: 46,
          },
        ]
      : [],
}));
