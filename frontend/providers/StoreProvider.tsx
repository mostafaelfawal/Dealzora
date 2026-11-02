"use client";

import { makeStore } from "@/lib/store";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Provider } from "react-redux";

const subscribe = () => () => {};

/** يتحط مرة واحدة في الـ layout الرئيسي (جوه ThemeProvider مثلاً). */
export function StoreProvider({ children }: { children: ReactNode }) {
  // false على السيرفر وأثناء الـ hydration، true بعد كده في المتصفح.
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  // الـ store بيتعمل في المتصفح بس، فـ Math.random() مابيتنفذش وقت الـ prerender.
  const store = useMemo(() => (isClient ? makeStore() : null), [isClient]);

  if (!store) return null;

  return <Provider store={store}>{children}</Provider>;
}
