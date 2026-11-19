"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { PublicProduct } from "./types";

/**
 * سلة كل متجر في متصفح الزائر (localStorage). الأسعار هنا للعرض فقط: السيرفر يعيد حسابها
 * في مراجعة السلة وعند الطلب، ولا يُرسل منها غير المعرّف والكمية.
 */

export interface CartLine {
  gid: string;
  name: string;
  unit: string;
  price: number;
  step: number;
  maxQty: number | null;
  imageUrl: string | null;
  /** × 1000 */
  qty: number;
}

const MAX_LINES = 60;
const EMPTY: CartLine[] = [];
const key = (slug: string) => `dz-cart:${slug}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; lines: CartLine[] }>();

function read(slug: string): CartLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key(slug));
  } catch {
    return EMPTY;
  }
  const hit = cache.get(slug);
  if (hit && hit.raw === raw) return hit.lines;
  let lines: CartLine[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed))
      lines = parsed
        .filter(
          (l): l is CartLine =>
            l &&
            typeof l.gid === "string" &&
            typeof l.qty === "number" &&
            l.qty > 0 &&
            typeof l.step === "number" &&
            l.step > 0,
        )
        .slice(0, MAX_LINES);
  } catch {
    lines = EMPTY;
  }
  cache.set(slug, { raw, lines });
  return lines;
}

function write(slug: string, lines: CartLine[]) {
  try {
    if (lines.length)
      window.localStorage.setItem(key(slug), JSON.stringify(lines));
    else window.localStorage.removeItem(key(slug));
  } catch {
    /* وضع التصفح الخاص: السلة تبقى للصفحة الحالية فقط */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("dz-cart:")) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const clamp = (qty: number, step: number, max: number | null) => {
  const limit = max === null ? Number.MAX_SAFE_INTEGER : max - (max % step);
  return Math.max(0, Math.min(qty - (qty % step), limit));
};

export function useCart(slug: string) {
  const lines = useSyncExternalStore(
    subscribe,
    () => read(slug),
    () => EMPTY,
  );

  const setQty = useCallback(
    (gid: string, qty: number) => {
      const current = read(slug);
      const next = current
        .map((l) =>
          l.gid === gid ? { ...l, qty: clamp(qty, l.step, l.maxQty) } : l,
        )
        .filter((l) => l.qty > 0);
      write(slug, next);
    },
    [slug],
  );

  const add = useCallback(
    (p: PublicProduct, qty = p.step) => {
      const current = read(slug);
      const found = current.find((l) => l.gid === p.gid);
      if (found) {
        setQty(p.gid, found.qty + qty);
        return;
      }
      if (current.length >= MAX_LINES) return;
      const line: CartLine = {
        gid: p.gid,
        name: p.name,
        unit: p.unit,
        price: p.price,
        step: p.step,
        maxQty: p.max_qty,
        imageUrl: p.image_url,
        qty: clamp(qty, p.step, p.max_qty),
      };
      if (line.qty > 0) write(slug, [...current, line]);
    },
    [slug, setQty],
  );

  /** تحديث من مراجعة السيرفر: الأسعار والحدود الحالية، وحذف ما لم يعد متاحاً. */
  const sync = useCallback(
    (
      server: {
        gid: string;
        name: string;
        unit: string;
        unit_price: number;
        qty: number;
        step: number;
        max_qty: number | null;
        image_url: string | null;
      }[],
    ) => {
      const map = new Map(server.map((s) => [s.gid, s]));
      const next = read(slug)
        .filter((l) => map.has(l.gid))
        .map((l) => {
          const s = map.get(l.gid)!;
          return {
            ...l,
            name: s.name,
            unit: s.unit,
            price: s.unit_price,
            step: s.step,
            maxQty: s.max_qty,
            imageUrl: s.image_url,
            qty: s.qty,
          };
        });
      if (JSON.stringify(next) !== JSON.stringify(read(slug)))
        write(slug, next);
    },
    [slug],
  );

  const clear = useCallback(() => write(slug, []), [slug]);

  const count = lines.length;
  const subtotal = lines.reduce(
    (sum, l) => sum + Math.round((l.price * l.qty) / 1000),
    0,
  );
  const qtyOf = (gid: string) => lines.find((l) => l.gid === gid)?.qty ?? 0;

  return { lines, count, subtotal, add, setQty, sync, clear, qtyOf };
}

/* ---------- طلباتي (رابط المتابعة محفوظ في هذا المتصفح فقط) ---------- */
export interface SavedOrder {
  number: number;
  token: string;
  total: number;
  at: string;
}

const ordersKey = (slug: string) => `dz-orders:${slug}`;

export function saveOrder(slug: string, o: SavedOrder) {
  try {
    const list = loadOrders(slug).filter((x) => x.token !== o.token);
    window.localStorage.setItem(
      ordersKey(slug),
      JSON.stringify([o, ...list].slice(0, 20)),
    );
  } catch {
    /* لا شيء */
  }
}

export function loadOrders(slug: string): SavedOrder[] {
  try {
    const raw = window.localStorage.getItem(ordersKey(slug));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter(
          (o) =>
            o && typeof o.token === "string" && /^[0-9a-f]{40}$/.test(o.token),
        )
      : [];
  } catch {
    return [];
  }
}

/** آخر بيانات توصيل استخدمها العميل في هذا المتجر (لتعبئة النموذج تلقائياً). */
const contactKey = (slug: string) => `dz-contact:${slug}`;

export interface Contact {
  name: string;
  phone: string;
  city: string;
  address: string;
}

export function loadContact(slug: string): Contact | null {
  try {
    const raw = window.localStorage.getItem(contactKey(slug));
    const c = raw ? JSON.parse(raw) : null;
    return c && typeof c.name === "string" ? c : null;
  } catch {
    return null;
  }
}

export function saveContact(slug: string, c: Contact) {
  try {
    window.localStorage.setItem(contactKey(slug), JSON.stringify(c));
  } catch {
    /* لا شيء */
  }
}
