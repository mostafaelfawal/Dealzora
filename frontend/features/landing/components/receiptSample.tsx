/**
 * إيصال توضيحي بنفس تصميم معاينة الإيصال في البرنامج (receipt-paper في globals.css).
 * الأصناف والأرقام مثال فقط، ومُعلَن عنها بوضوح للزائر.
 */
const LINES = [
  {
    name: "أرز أبيض 1 كجم",
    qty: "2",
    unit: "كيس",
    price: "38.00",
    total: "76.00",
  },
  {
    name: "زيت عباد الشمس",
    qty: "1",
    unit: "زجاجة",
    price: "95.00",
    total: "95.00",
  },
  {
    name: "شاي 250 جم",
    qty: "3",
    unit: "علبة",
    price: "42.50",
    total: "127.50",
  },
  {
    name: "مياه معدنية",
    qty: "1",
    unit: "كرتونة",
    price: "60.00",
    total: "60.00",
  },
] as const;

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex items-baseline justify-between text-sm font-bold"
          : "flex items-baseline justify-between"
      }
    >
      <dt>{label}</dt>
      <dd className="font-mono" dir="ltr">
        {value}
      </dd>
    </div>
  );
}

export function ReceiptSample() {
  return (
    <figure className="mx-auto w-full max-w-sm lg:max-w-none">
      <div className="relative mx-auto w-full max-w-85 pt-2">
        <div
          aria-hidden
          className="receipt-slot absolute -inset-x-3 top-0 z-10 h-4 rounded-full"
        />
        <div className="-mx-6 overflow-hidden px-6 pb-10">
          <div className="landing-print receipt-shadow">
            <article
              aria-label="مثال توضيحي لإيصال بيع من Dealzora"
              className="receipt-paper relative px-5 text-xs"
            >
              <header className="space-y-0.5 text-center">
                <p className="text-base font-bold">اسم متجرك</p>
                <p className="text-muted-foreground">
                  فاتورة رقم{" "}
                  <b className="font-mono text-foreground" dir="ltr">
                    #1024
                  </b>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  الكاشير: أحمد · العميل: عميل نقدي
                </p>
              </header>

              <hr aria-hidden className="receipt-rule my-3" />

              <ul className="space-y-2">
                {LINES.map((l) => (
                  <li key={l.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{l.name}</span>
                      <span className="font-mono" dir="ltr">
                        {l.total}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {l.qty} {l.unit} ×{" "}
                      <span className="font-mono" dir="ltr">
                        {l.price}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <hr aria-hidden className="receipt-rule my-3" />

              <dl className="space-y-1">
                <Row label="الإجمالي" value="358.50" />
                <Row label="خصم الفاتورة" value="-8.50" />
                <Row label="المطلوب (ج.م)" value="350.00" strong />
                <Row label="المدفوع نقداً" value="400.00" />
                <Row label="الباقي" value="50.00" />
              </dl>

              <hr aria-hidden className="receipt-rule my-3" />

              <p className="text-center text-[11px] text-muted-foreground">
                شكراً لزيارتكم
              </p>
              <div
                aria-hidden
                className="receipt-barcode mx-auto mt-3 h-10 w-44"
              />
            </article>
          </div>
        </div>
      </div>
      <figcaption className="-mt-4 text-center text-xs text-muted-foreground">
        مثال توضيحي لإيصال يطبعه Dealzora على الطابعة الحرارية
      </figcaption>
    </figure>
  );
}
