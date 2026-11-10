/** قيمة تغيير مقروءة: الفارغ "—"، والكائنات JSON. */
export const formatChangeValue = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? "—"
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v);

export interface ChangeDiff {
  from: unknown;
  to: unknown;
}

/** هل القيمة على شكل {from, to}؟ */
export const asDiff = (value: unknown): ChangeDiff | null =>
  value && typeof value === "object" && "from" in value && "to" in value
    ? (value as ChangeDiff)
    : null;
