import type { Metadata } from "next";

import { MyOrders } from "@/components/myOrders";

export const metadata: Metadata = {
  title: "طلباتي",
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return <MyOrders />;
}
