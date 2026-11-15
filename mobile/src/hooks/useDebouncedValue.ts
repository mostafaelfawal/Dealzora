import { useEffect, useState } from "react";

/** القيمة بعد توقف الكتابة (للبحث: طلب واحد بدل طلب لكل حرف). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
