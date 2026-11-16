import type { Sale } from "@/features/sales/types/sale";

/** فاتورة تجريبية لمعاينة شكل الفاتورة وطباعة صفحة التجربة (أرقام منطقية لمحل بقالة). */
export function sampleSale(): Sale {
  const lines = [
    {
      name: "أرز مصري 1 كجم",
      qty: 2,
      unitName: "كيس",
      unitPrice: 45,
      discount: 0,
      promoDiscount: 0,
      promoName: null,
    },
    {
      name: "زيت عباد الشمس 800 مل",
      qty: 1,
      unitName: "زجاجة",
      unitPrice: 95,
      discount: 5,
      promoDiscount: 0,
      promoName: null,
    },
    {
      name: "شاي ناعم 250 جم",
      qty: 3,
      unitName: "علبة",
      unitPrice: 38,
      discount: 0,
      promoDiscount: 38,
      promoName: "اشترِ 2 والثالثة مجاناً",
    },
    {
      name: "مياه معدنية 1.5 لتر",
      qty: 1,
      unitName: "كرتونة",
      unitPrice: 72,
      discount: 0,
      promoDiscount: 0,
      promoName: null,
    },
  ].map((l, i) => {
    const lineTotal = l.qty * l.unitPrice - l.discount - l.promoDiscount;
    return {
      id: `s${i}`,
      productId: `p${i}`,
      unitId: null,
      factor: 1,
      isWholesale: false,
      netTotal: lineTotal,
      taxRate: null,
      taxAmount: null,
      returnedQty: 0,
      unitCost: null,
      lineTotal,
      ...l,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const linesDiscount = lines.reduce((s, l) => s + l.discount, 0);
  const promoDiscount = lines.reduce((s, l) => s + l.promoDiscount, 0);
  const total = subtotal - linesDiscount - promoDiscount;
  return {
    id: "sample",
    number: 1024,
    soldAt: Date.now(),
    customerId: null,
    customerName: "أحمد محمود",
    customerPhone: "01012345678",
    cashierName: "محمد",
    paymentMethod: "cash",
    paymentLabel: "نقدي",
    subtotal,
    linesDiscount,
    promoDiscount,
    loyaltyRedeemed: 0,
    loyaltyDiscount: 0,
    loyaltyEarned: 0,
    customerPoints: null,
    invoiceDiscount: 0,
    taxMode: null,
    taxableTotal: null,
    taxTotal: null,
    etaStatus: null,
    etaUuid: null,
    etaReceiptNumber: null,
    etaError: null,
    etaPrint: null,
    total,
    cashAmount: total,
    creditAmount: 0,
    walletAmount: 0,
    paymentRef: null,
    received: 400,
    change: 400 - total,
    changeKept: 0,
    balanceUsed: 0,
    customerBalance: null,
    returnedTotal: 0,
    costTotal: null,
    profit: null,
    note: "",
    lines,
  } as Sale;
}
