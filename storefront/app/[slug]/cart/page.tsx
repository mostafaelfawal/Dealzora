import type { Metadata } from "next";

import { CheckoutView } from "@/components/checkoutView";

export const metadata: Metadata = {
  title: "السلة وإتمام الطلب",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CheckoutView />;
}
