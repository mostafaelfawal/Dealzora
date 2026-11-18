import { IconBrandWhatsapp, IconClock, IconMapPin, IconPhone } from "@tabler/icons-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CartBar } from "@/components/cartBar";
import { StoreProvider } from "@/components/storeContext";
import { StoreHeader } from "@/components/storeHeader";
import { waLink } from "@/lib/format";

import { getStore } from "./data";

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore(slug);
  const description =
    store.tagline ?? store.about?.slice(0, 160) ?? `اطلب من ${store.name} أونلاين والدفع عند الاستلام.`;
  return {
    title: { default: store.name, template: `%s | ${store.name}` },
    description,
    alternates: { canonical: `/${store.slug}` },
    openGraph: {
      type: "website",
      siteName: store.name,
      title: store.name,
      description,
      locale: "ar_EG",
      url: `/${store.slug}`,
      ...(store.logo_url ? { images: [{ url: store.logo_url, width: 512, height: 512 }] } : {}),
    },
    icons: store.logo_url ? { icon: store.logo_url } : undefined,
  };
}

export default async function StoreLayout({ children, params }: Props) {
  const { slug } = await params;
  const store = await getStore(slug);
  const info = {
    slug: store.slug,
    name: store.name,
    currency: store.currency,
    phone: store.phone,
    whatsapp: store.whatsapp,
    accepting_orders: store.accepting_orders,
    delivery_fee: store.delivery_fee,
    free_delivery_over: store.free_delivery_over,
    min_order: store.min_order,
    delivery_note: store.delivery_note,
  };

  return (
    <StoreProvider store={info}>
      <Suspense fallback={<div className="h-16 border-b" />}>
        <StoreHeader logoUrl={store.logo_url} />
      </Suspense>
      {!store.accepting_orders && (
        <div className="border-b bg-warning/15 px-4 py-2 text-center text-sm">
          المتجر لا يستقبل طلبات الآن. يمكنك التصفح والتواصل معه بالهاتف.
        </div>
      )}
      <main className="mx-auto min-h-[60dvh] max-w-6xl px-4 py-6 pb-28 md:pb-12">{children}</main>
      <footer className="border-t bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
          <div className="space-y-1">
            <p className="font-bold">{store.name}</p>
            {store.tagline && <p className="text-muted-foreground">{store.tagline}</p>}
          </div>
          <ul className="space-y-2 text-muted-foreground">
            {store.address && (
              <li className="flex items-start gap-2">
                <IconMapPin className="mt-0.5 size-4 shrink-0" />
                {store.city ? `${store.city} — ` : ""}
                {store.address}
              </li>
            )}
            {store.hours && (
              <li className="flex items-start gap-2">
                <IconClock className="mt-0.5 size-4 shrink-0" />
                {store.hours}
              </li>
            )}
          </ul>
          <ul className="space-y-2">
            <li>
              <a href={`tel:${store.phone}`} className="flex items-center gap-2 hover:underline">
                <IconPhone className="size-4" />
                <span dir="ltr" className="font-mono">
                  {store.phone}
                </span>
              </a>
            </li>
            {store.whatsapp && (
              <li>
                <a
                  href={waLink(store.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:underline"
                >
                  <IconBrandWhatsapp className="size-4" />
                  تواصل على واتساب
                </a>
              </li>
            )}
            <li>
              <Link href={`/${store.slug}/orders`} className="text-muted-foreground hover:underline">
                طلباتي
              </Link>
            </li>
          </ul>
        </div>
        <p className="border-t py-3 text-center text-[11px] text-muted-foreground">
          الدفع عند الاستلام · متجر يعمل بنظام Dealzora
        </p>
      </footer>
      <CartBar />
    </StoreProvider>
  );
}
