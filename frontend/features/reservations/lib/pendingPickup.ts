/**
 * «استلام في الكاشير» من صفحة الحجوزات: نحفظ معرّف الحجز ثم ننتقل للكاشير،
 * وشاشة الكاشير تحمّله في الفاتورة عند فتحها (بلا باراميتر في الرابط).
 */
const KEY = "dealzora:pending-pickup";

export function setPendingPickup(id: string) {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    // التخزين غير متاح: يختار الكاشير الحجز من قائمة الحجوزات.
  }
}

/** يرجّع المعرّف ويمسحه (يُحمَّل مرة واحدة). */
export function takePendingPickup(): string | null {
  try {
    const id = sessionStorage.getItem(KEY);
    if (id) sessionStorage.removeItem(KEY);
    return id;
  } catch {
    return null;
  }
}
