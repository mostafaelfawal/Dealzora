"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { PublicStore } from "@/lib/types";

export type StoreInfo = Pick<
  PublicStore,
  | "slug"
  | "name"
  | "currency"
  | "phone"
  | "whatsapp"
  | "accepting_orders"
  | "delivery_fee"
  | "free_delivery_over"
  | "min_order"
  | "delivery_note"
>;

const Ctx = createContext<StoreInfo | null>(null);

export function StoreProvider({
  store,
  children,
}: {
  store: StoreInfo;
  children: ReactNode;
}) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): StoreInfo {
  const store = useContext(Ctx);
  if (!store) throw new Error("useStore outside StoreProvider");
  return store;
}
