"use client";

import {
  IconAlertTriangle,
  IconArrowRight,
  IconCash,
  IconLoader2,
  IconLock,
  IconShoppingBag,
  IconTruckDelivery,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  loadContact,
  saveContact,
  saveOrder,
  useCart,
  type CartLine,
} from "@/lib/cart";
import { ApiError, newClientRef, storeApi } from "@/lib/client";
import { formatMoney, normalizeDigits } from "@/lib/format";
import type { OrderCreated, Quote } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Price } from "./price";
import { ProductImage } from "./productCard";
import { QtyStepper } from "./qtyStepper";
import { useStore } from "./storeContext";
import { Button, ButtonLink, Field, Input, Textarea } from "./ui";

const PHONE_RE = /^\+?[\d\s\-()]{8,20}$/;

type Form = {
  name: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
};
type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = "اكتب اسمك";
  const phone = normalizeDigits(f.phone).trim();
  if (!PHONE_RE.test(phone) || phone.replace(/\D/g, "").length < 8)
    e.phone = "رقم هاتف صحيح نتواصل معك عليه";
  if (f.address.trim().length < 5)
    e.address = "اكتب العنوان بالتفصيل (الشارع، رقم العقار، الدور)";
  return e;
}

const keyOf = (lines: CartLine[]) =>
  lines.map((l) => `${l.gid}:${l.qty}`).join("|");

/** مراجعة السلة بأسعار السيرفر الحالية (بعد توقف التعديل لحظة). */
function useQuote(
  slug: string,
  lines: CartLine[],
  onQuote: (q: Quote) => void,
) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = keyOf(lines);
  const handler = useRef(onQuote);
  useEffect(() => {
    handler.current = onQuote;
  });

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    const id = window.setTimeout(() => {
      setLoading(true);
      storeApi<Quote>(slug, "/quote", {
        method: "POST",
        body: {
          items: key
            .split("|")
            .map((x) => ({
              gid: x.split(":")[0],
              qty: Number(x.split(":")[1]),
            })),
        },
        signal: ctrl.signal,
      })
        .then((q) => {
          setQuote(q);
          setError(null);
          handler.current(q);
        })
        .catch((e) => {
          if (e instanceof DOMException) return;
          setError(e instanceof ApiError ? e.message : "تعذّر مراجعة السلة");
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [slug, key]);

  return { quote: key ? quote : null, error, loading };
}

export function CheckoutView() {
  const store = useStore();
  const cart = useCart(store.slug);
  const router = useRouter();
  const [notices, setNotices] = useState<string[]>([]);
  // تصحيحات السيرفر (نفد، الكمية المتاحة أقل) تنعكس على السلة ويراها العميل.
  const {
    quote,
    error: quoteError,
    loading,
  } = useQuote(store.slug, cart.lines, (q) => {
    if (q.issues.length) setNotices(q.issues.map((i) => i.message));
    cart.sync(q.lines);
  });
  // بيانات آخر طلب من هذا المتصفح (العميل لا يكتبها كل مرة).
  const [form, setForm] = useState<Form>(() => ({
    name: "",
    phone: "",
    city: "",
    address: "",
    notes: "",
    ...(loadContact(store.slug) ?? {}),
  }));
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const ref = useRef<string>("");
  const honeypot = useRef<HTMLInputElement>(null);

  const errors = validate(form);
  const show = (k: keyof Form) => (touched ? errors[k] : undefined);
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const total = quote?.total ?? cart.subtotal;
  const subtotal = quote?.subtotal ?? cart.subtotal;
  const below = quote ? quote.subtotal < quote.min_order : false;
  const closed = !store.accepting_orders || quote?.accepting_orders === false;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setSubmitError(null);
    if (Object.keys(errors).length || below || closed || !cart.lines.length)
      return;
    if (!ref.current) ref.current = newClientRef();
    setSubmitting(true);
    const contact = {
      name: form.name.trim(),
      phone: normalizeDigits(form.phone).trim(),
      city: form.city.trim(),
      address: form.address.trim(),
    };
    try {
      const out = await storeApi<OrderCreated>(store.slug, "/orders", {
        method: "POST",
        body: {
          client_ref: ref.current,
          ...contact,
          city: contact.city || null,
          notes: form.notes.trim() || null,
          items: cart.lines.map((l) => ({ gid: l.gid, qty: l.qty })),
          website: honeypot.current?.value ?? "",
        },
      });
      saveContact(store.slug, contact);
      saveOrder(store.slug, {
        number: out.number,
        token: out.token,
        total: out.total,
        at: out.created_at,
      });
      cart.clear();
      router.replace(`/${store.slug}/order/${out.token}?new=1`);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError) {
        setSubmitError(err.message);
        const gid = err.details?.gid;
        // نفس الطلب لم يُنشأ: مفتاح جديد للمحاولة التالية بعد تعديل السلة.
        if (err.status !== 0 && err.status !== 429) ref.current = "";
        if (typeof gid === "string" && typeof err.details?.max_qty === "number")
          cart.setQty(gid, err.details.max_qty as number);
      } else setSubmitError("تعذّر إرسال الطلب. حاول مرة أخرى");
    }
  }

  if (cart.lines.length === 0)
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <span className="flex size-16 items-center justify-center bg-muted">
          <IconShoppingBag className="size-8 text-muted-foreground" />
        </span>
        <h1 className="text-xl font-bold">السلة فارغة</h1>
        <p className="text-sm text-muted-foreground">
          {notices.length
            ? notices.join("، ")
            : "أضف ما تحتاجه من الأصناف ثم ارجع هنا لإتمام الطلب."}
        </p>
        <ButtonLink href={`/${store.slug}`} size="lg">
          <IconArrowRight />
          تصفّح الأصناف
        </ButtonLink>
      </div>
    );

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start"
    >
      <div className="space-y-6">
        <section className="border bg-card">
          <header className="flex items-center justify-between border-b p-4">
            <h1 className="text-lg font-bold">سلة المشتريات</h1>
            <span className="text-sm text-muted-foreground">
              {cart.count} صنف
            </span>
          </header>
          {notices.length > 0 && (
            <div className="flex gap-2 border-b bg-warning/10 p-3 text-sm">
              <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <ul className="space-y-0.5">
                {notices.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          <ul className="divide-y">
            {cart.lines.map((l) => (
              <li key={l.gid} className="flex items-center gap-3 p-3 sm:p-4">
                <Link href={`/${store.slug}/p/${l.gid}`} className="shrink-0">
                  <ProductImage
                    url={l.imageUrl}
                    name={l.name}
                    className="size-16 border sm:size-20"
                  />
                </Link>
                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={`/${store.slug}/p/${l.gid}`}
                    className="line-clamp-2 text-sm font-medium hover:underline"
                  >
                    {l.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(l.price, store.currency)} / {l.unit}
                  </p>
                  <QtyStepper
                    qty={l.qty}
                    step={l.step}
                    max={l.maxQty}
                    unit={l.unit}
                    size="sm"
                    className="w-36 sm:hidden"
                    onChange={(v) => cart.setQty(l.gid, v)}
                  />
                </div>
                <QtyStepper
                  qty={l.qty}
                  step={l.step}
                  max={l.maxQty}
                  unit={l.unit}
                  className="hidden w-40 sm:flex"
                  onChange={(v) => cart.setQty(l.gid, v)}
                />
                <Price
                  cents={Math.round((l.price * l.qty) / 1000)}
                  currency={store.currency}
                  className="w-24 justify-end text-sm"
                />
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 border bg-card p-4">
          <h2 className="flex items-center gap-2 font-bold">
            <IconTruckDelivery className="size-5" />
            بيانات التوصيل
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="c-name" label="الاسم" error={show("name")}>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                autoComplete="name"
                maxLength={80}
                aria-invalid={Boolean(show("name"))}
                aria-describedby={show("name") ? "c-name-error" : undefined}
              />
            </Field>
            <Field
              id="c-phone"
              label="رقم الهاتف"
              error={show("phone")}
              hint="للتواصل بخصوص الطلب فقط"
            >
              <Input
                id="c-phone"
                type="tel"
                dir="ltr"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                autoComplete="tel"
                maxLength={20}
                placeholder="01xxxxxxxxx"
                className="text-start"
                aria-invalid={Boolean(show("phone"))}
                aria-describedby={show("phone") ? "c-phone-error" : undefined}
              />
            </Field>
            <Field
              id="c-city"
              label="المنطقة / المدينة"
              className="sm:col-span-2"
            >
              <Input
                id="c-city"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                autoComplete="address-level2"
                maxLength={60}
              />
            </Field>
            <Field
              id="c-address"
              label="العنوان بالتفصيل"
              error={show("address")}
              className="sm:col-span-2"
            >
              <Textarea
                id="c-address"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                autoComplete="street-address"
                maxLength={300}
                rows={2}
                placeholder="الشارع، رقم العقار، الدور، علامة مميزة"
                aria-invalid={Boolean(show("address"))}
                aria-describedby={
                  show("address") ? "c-address-error" : undefined
                }
              />
            </Field>
            <Field
              id="c-notes"
              label="ملاحظات (اختياري)"
              className="sm:col-span-2"
            >
              <Textarea
                id="c-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="مثال: الاتصال قبل الوصول"
              />
            </Field>
          </div>
          {/* حقل فخ للبرامج الآلية: مخفي عن الزوار وقارئات الشاشة. */}
          <div
            aria-hidden
            className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
          >
            <label htmlFor="c-website">الموقع</label>
            <input
              id="c-website"
              ref={honeypot}
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>
        </section>
      </div>

      <aside className="space-y-4 border bg-card p-4 lg:sticky lg:top-24">
        <h2 className="font-bold">ملخص الطلب</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">الأصناف</dt>
            <dd>
              <Price cents={subtotal} currency={store.currency} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">التوصيل</dt>
            <dd>
              {quote ? (
                quote.delivery_fee > 0 ? (
                  <Price cents={quote.delivery_fee} currency={store.currency} />
                ) : (
                  <span className="font-medium text-success">مجاني</span>
                )
              ) : (
                <span className="text-muted-foreground">…</span>
              )}
            </dd>
          </div>
          {quote?.free_delivery_over != null && quote.delivery_fee > 0 && (
            <p className="bg-muted p-2 text-xs text-muted-foreground">
              أضف بقيمة{" "}
              {formatMoney(
                quote.free_delivery_over - quote.subtotal,
                store.currency,
              )}{" "}
              للحصول على توصيل مجاني.
            </p>
          )}
          <div className="flex items-baseline justify-between border-t pt-3 text-base font-bold">
            <dt>الإجمالي</dt>
            <dd className="flex items-center gap-2">
              {loading && (
                <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              <Price
                cents={total}
                currency={store.currency}
                className="text-xl"
              />
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-2 border p-3 text-sm">
          <IconCash className="size-5 shrink-0" />
          <div>
            <p className="font-medium">الدفع عند الاستلام</p>
            <p className="text-xs text-muted-foreground">
              ادفع نقداً للمندوب عند استلام طلبك.
            </p>
          </div>
        </div>

        {store.delivery_note && (
          <p className="text-xs text-muted-foreground">{store.delivery_note}</p>
        )}

        {below && quote && (
          <p className="bg-warning/10 p-2 text-xs">
            أقل قيمة للطلب {formatMoney(quote.min_order, store.currency)}. أضف
            أصنافاً بقيمة{" "}
            {formatMoney(quote.min_order - quote.subtotal, store.currency)}.
          </p>
        )}
        {closed && (
          <p className="bg-destructive/10 p-2 text-xs text-destructive">
            المتجر لا يستقبل طلبات الآن. حاول لاحقاً أو تواصل معه بالهاتف.
          </p>
        )}
        {(submitError || quoteError) && (
          <p
            role="alert"
            className="bg-destructive/10 p-2 text-sm text-destructive"
          >
            {submitError ?? quoteError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className={cn("w-full")}
          disabled={submitting || below || closed || !quote}
        >
          {submitting ? (
            <>
              <IconLoader2 className="animate-spin" />
              جارٍ إرسال الطلب…
            </>
          ) : (
            <>
              تأكيد الطلب ·
              <Price
                cents={total}
                currency={store.currency}
                className="[&_span:last-child]:text-primary-foreground/70"
              />
            </>
          )}
        </Button>
        <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <IconLock className="size-3.5" />
          بياناتك تصل للمتجر فقط لتوصيل طلبك.
        </p>
      </aside>
    </form>
  );
}
