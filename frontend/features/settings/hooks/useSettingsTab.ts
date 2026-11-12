"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "dealzora:settings-tab-change";

interface NavigationLike {
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

/**
 * روابط Next لنفس الصفحة (مثل «عرض الخطط» وأنت داخل الإعدادات) تغيّر الـ hash
 * بـ pushState فلا يُطلق hashchange، فنسمع أيضاً لـ Navigation API (WebView2/Chromium).
 */
function subscribe(onChange: () => void) {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  nav?.addEventListener("currententrychange", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    nav?.removeEventListener("currententrychange", onChange);
  };
}

const readHash = () => decodeURIComponent(window.location.hash.slice(1));

/** القسم المفتوح في الإعدادات، محفوظ في الرابط (#plans) ليعمل الرجوع والروابط المباشرة. */
export function useSettingsTab<T extends string>(ids: readonly T[]) {
  const hash = useSyncExternalStore(subscribe, readHash, () => "");
  const active = (ids as readonly string[]).includes(hash)
    ? (hash as T)
    : ids[0];

  const setActive = useCallback((id: T) => {
    // replace بدل push: التنقل بين الأقسام لا يملأ سجل الرجوع.
    window.history.replaceState(window.history.state, "", `#${id}`);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { active, setActive };
}
