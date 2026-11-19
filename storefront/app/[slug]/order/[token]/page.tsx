import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OrderTracker } from "@/components/orderTracker";

// رابط متابعة الطلب سري: لا فهرسة، ولا يُرسل في Referer لمواقع أخرى.
export const metadata: Metadata = {
  title: "متابعة الطلب",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f]{40}$/.test(token)) notFound();
  return (
    <Suspense>
      <OrderTracker token={token} />
    </Suspense>
  );
}
