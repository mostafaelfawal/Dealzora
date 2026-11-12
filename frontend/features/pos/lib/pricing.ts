import type { CartLine, PosInvoice, PosPromotion } from "../types/pos";

/**
 * تسعير سطور الفاتورة: سعر الجملة والعروض التلقائية.
 * نسخة حرفية من الـ backend (modules/sales/pricing.py) وبالقروش وأعداد صحيحة،
 * لأن السيرفر يقارن سعر كل سطر وخصم عرضه بما حسبه ويرفض أي اختلاف.
 *
 * - الجملة: للصنف سعر جملة، والعميل «عميل جملة» أو كمية الصنف في الفاتورة وصلت كمية الجملة.
 * - العروض: على سعر القطاعي فقط، ولكل سطر أفضل عرض للعميل.
 */

const QTY = 1000;

/** قسمة صحيحة بتقريب النصف لأعلى (round_div في الـ backend). */
function roundDiv(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.floor((numerator * 2 + denominator) / (denominator * 2));
}

const cents = (pounds: number) => Math.round(pounds * 100);
const scaled = (qty: number) => Math.round(qty * QTY);
/** قيمة كمية (× 1000) بسعر وحدة (قروش). */
const qtyAmount = (qtyScaled: number, priceCents: number) =>
  roundDiv(qtyScaled * priceCents, QTY);

function promoMatches(promo: PosPromotion, line: CartLine): boolean {
  if (promo.scope === "all") return true;
  if (promo.scope === "category")
    return Boolean(line.category) && line.category === promo.categoryId;
  return promo.productIds.includes(line.productId);
}

function promoAmount(
  promo: PosPromotion,
  isBaseUnit: boolean,
  base: number,
  price: number,
  gross: number,
): number {
  if (promo.kind === "buy_get") {
    if (!isBaseUnit || !promo.buyQty || !promo.getQty) return 0;
    const group = promo.buyQty + promo.getQty;
    const free = Math.floor(Math.floor(base / QTY) / group) * promo.getQty;
    return Math.min(gross, free * price);
  }
  if (promo.minQty && base < promo.minQty) return 0;
  if (promo.kind === "percent")
    return Math.min(gross, roundDiv(gross * promo.value, 100));
  if (promo.kind === "amount")
    return Math.min(gross, qtyAmount(base, promo.value));
  return 0;
}

/** يعيد سعر كل سطر وعرضه حسب العميل والكميات والعروض السارية. */
export function priceInvoice(
  invoice: PosInvoice,
  promotions: PosPromotion[],
): PosInvoice {
  const wholesaleCustomer = Boolean(invoice.customer?.isWholesale);
  const bases = invoice.lines.map((l) =>
    roundDiv(scaled(l.qty) * scaled(l.factor ?? 1), QTY),
  );
  const demand = new Map<string, number>();
  invoice.lines.forEach((l, i) =>
    demand.set(l.productId, (demand.get(l.productId) ?? 0) + bases[i]),
  );

  let changed = false;
  const lines = invoice.lines.map((line, i) => {
    const base = bases[i];
    const retail = cents(line.retailPrice ?? line.price);
    const wholesale =
      line.wholesalePrice === null || line.wholesalePrice === undefined
        ? null
        : cents(line.wholesalePrice);
    const minQty = line.wholesaleMinQty ? scaled(line.wholesaleMinQty) : 0;
    const reached = minQty > 0 && (demand.get(line.productId) ?? 0) >= minQty;
    const useWholesale =
      wholesale !== null &&
      wholesale < retail &&
      (wholesaleCustomer || reached);
    const price = useWholesale && wholesale !== null ? wholesale : retail;
    const gross = qtyAmount(scaled(line.qty), price);

    let best = 0;
    let bestPromo: PosPromotion | null = null;
    if (!useWholesale) {
      for (const promo of promotions) {
        if (!promoMatches(promo, line)) continue;
        const amount = promoAmount(promo, !line.unitId, base, price, gross);
        if (amount > best) {
          best = amount;
          bestPromo = promo;
        }
      }
    }

    const next: CartLine = {
      ...line,
      retailPrice: retail / 100,
      price: price / 100,
      wholesale: useWholesale,
      promo: best / 100,
      promoName: bestPromo?.name ?? null,
      // خصم الكاشير لا يتجاوز قيمة السطر بعد العرض.
      discount:
        line.discount && line.discount > (gross - best) / 100
          ? (gross - best) / 100
          : line.discount,
    };
    const differs =
      next.price !== line.price ||
      next.promo !== line.promo ||
      next.promoName !== line.promoName ||
      next.wholesale !== line.wholesale ||
      next.retailPrice !== line.retailPrice ||
      next.discount !== line.discount;
    if (differs) changed = true;
    return differs ? next : line;
  });
  return changed ? { ...invoice, lines } : invoice;
}

/** وصف قصير للعرض (في الكاشير والإيصال وقائمة العروض). */
export function promoLabel(
  p: Pick<PosPromotion, "kind" | "value" | "buyQty" | "getQty">,
): string {
  if (p.kind === "buy_get") return `اشتري ${p.buyQty} وخد ${p.getQty}`;
  if (p.kind === "percent") return `خصم ${p.value}%`;
  return `خصم ${p.value / 100} على القطعة`;
}
