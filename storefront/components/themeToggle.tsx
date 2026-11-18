"use client";

import { IconMoon, IconSun } from "@tabler/icons-react";
import { useSyncExternalStore } from "react";

import { Button } from "./ui";

const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributeFilter: ["class"] });
  return () => obs.disconnect();
};
const isDark = () => document.documentElement.classList.contains("dark");

/** الوضع الداكن: يتبع الجهاز افتراضياً، واختيار الزائر يُحفظ في متصفحه. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={dark ? "الوضع الفاتح" : "الوضع الداكن"}
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("dz-theme", next ? "dark" : "light");
        } catch {
          /* لا شيء */
        }
      }}
    >
      {dark ? <IconSun /> : <IconMoon />}
    </Button>
  );
}

/** يُنفَّذ قبل رسم الصفحة حتى لا تومض بالفاتح عند زائر يفضّل الداكن. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("dz-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;
