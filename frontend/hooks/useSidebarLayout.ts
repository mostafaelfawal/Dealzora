"use client";

import { useSyncExternalStore } from "react";

import type { NavGroup, NavItem } from "@/types/navigation";

/**
 * ترتيب القائمة الجانبية كما خصّصه المستخدم، محفوظ على هذا الجهاز.
 * - order: ترتيب روابط كل مجموعة (الصفحات الجديدة تُضاف في آخر مجموعتها).
 * - demoted: صفحات نقلها المستخدم إلى قسم "أقل استخداماً" أسفل القائمة.
 */
export interface SidebarLayout {
  order: Record<string, string[]>;
  demoted: string[];
  demotedOpen: boolean;
}

const STORAGE_KEY = "dealzora:sidebar-layout";
const CHANGE_EVENT = "dealzora:sidebar-layout-change";
const EMPTY: SidebarLayout = { order: {}, demoted: [], demotedOpen: false };

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

function parse(raw: string | null): SidebarLayout {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as Partial<SidebarLayout>;
    const order: Record<string, string[]> = {};
    if (data.order && typeof data.order === "object") {
      for (const [id, hrefs] of Object.entries(data.order)) {
        if (isStringArray(hrefs)) order[id] = hrefs;
      }
    }
    return {
      order,
      demoted: isStringArray(data.demoted) ? data.demoted : [],
      demotedOpen: data.demotedOpen === true,
    };
  } catch {
    return EMPTY; // قيمة تالفة: نرجع للترتيب الافتراضي.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// نفس النص المحفوظ يرجّع نفس الكائن، حتى لا يعيد React الرسم بلا داعٍ.
let cachedRaw: string | null | undefined;
let cached: SidebarLayout = EMPTY;

function getSnapshot(): SidebarLayout {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // التخزين غير متاح: الترتيب الافتراضي.
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function update(change: (layout: SidebarLayout) => SidebarLayout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(change(getSnapshot())));
  } catch {
    // وضع التصفح الخاص أو تخزين ممتلئ: لا يُحفظ الترتيب.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function reset() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // تجاهل.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const sidebarLayoutActions = {
  setGroupOrder: (groupId: string, hrefs: string[]) =>
    update((l) => ({ ...l, order: { ...l.order, [groupId]: hrefs } })),
  setDemotedOrder: (hrefs: string[]) =>
    update((l) => ({ ...l, demoted: hrefs })),
  demote: (href: string) =>
    update((l) => ({
      ...l,
      demoted: [...l.demoted.filter((h) => h !== href), href],
    })),
  restore: (href: string) =>
    update((l) => ({ ...l, demoted: l.demoted.filter((h) => h !== href) })),
  toggleDemotedOpen: () =>
    update((l) => ({ ...l, demotedOpen: !l.demotedOpen })),
  reset,
};

export function useSidebarLayout() {
  const layout = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return { layout, ...sidebarLayoutActions };
}

/** ترتيب حسب القائمة المحفوظة، وما ليس فيها يبقى بترتيبه الأصلي في الآخر. */
function sortBy(items: NavItem[], saved: string[] | undefined): NavItem[] {
  if (!saved?.length) return items;
  const rank = new Map(saved.map((href, i) => [href, i]));
  return items
    .map((item, i) => ({ item, key: rank.get(item.href) ?? saved.length + i }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

/**
 * يطبّق تخصيص المستخدم على مجموعات القائمة (بعد تصفية الصلاحيات).
 * الصفحات المنقولة لأسفل تُحذف من مجموعاتها وتُرجَع في demoted بترتيبها.
 */
export function applySidebarLayout(
  groups: NavGroup[],
  layout: SidebarLayout,
): { groups: NavGroup[]; demoted: NavItem[] } {
  const demotedSet = new Set(layout.demoted);
  const all = new Map(groups.flatMap((g) => g.items).map((i) => [i.href, i]));

  const visible = groups
    .map((group) => ({
      ...group,
      items: sortBy(
        group.items.filter((item) => !demotedSet.has(item.href)),
        layout.order[group.id],
      ),
    }))
    .filter((group) => group.items.length > 0);

  // صفحة محذوفة أو ممنوعة على هذا الدور تُتجاهل.
  const demoted = layout.demoted.flatMap((href) => {
    const item = all.get(href);
    return item ? [item] : [];
  });

  return { groups: visible, demoted };
}
