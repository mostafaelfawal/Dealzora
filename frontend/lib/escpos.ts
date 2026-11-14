/**
 * تحويل صورة الإيصال (canvas) لأوامر ESC/POS تفهمها كل الطابعات الحرارية تقريباً.
 *
 * نطبع الإيصال كصورة نقطية (GS v 0) بدل نص: العربي في وضع النص يحتاج code page
 * وتشكيل حروف لا تدعمه أغلب الطابعات، والصورة تطلع مطابقة لما يظهر على الشاشة.
 */

const ESC = 0x1b;
const GS = 0x1d;

/** عدد صفوف الصورة في كل أمر: بعض الطابعات بذاكرة صغيرة ترفض الصور الطويلة دفعة واحدة. */
const ROWS_PER_BAND = 128;
/** أفتح من هذا = أبيض. أعلى من 128 قليلاً حتى لا تختفي أطراف الحروف الرفيعة. */
const THRESHOLD = 170;

export interface EscPosOptions {
  cut: boolean;
  feedLines: number;
  openDrawer: boolean;
}

export function canvasToEscPos(
  canvas: HTMLCanvasElement,
  opts: EscPosOptions,
): Uint8Array {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر تجهيز صورة الإيصال");
  const { width, height } = canvas;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const bytesPerRow = Math.ceil(width / 8);

  const out: number[] = [];
  out.push(ESC, 0x40); // تهيئة الطابعة
  // الدرج أولاً: يفتح فور البيع بدون انتظار انتهاء الطباعة.
  if (opts.openDrawer) out.push(ESC, 0x70, 0x00, 0x19, 0xfa);

  for (let top = 0; top < height; top += ROWS_PER_BAND) {
    const rows = Math.min(ROWS_PER_BAND, height - top);
    // GS v 0 m xL xH yL yH
    out.push(GS, 0x76, 0x30, 0x00);
    out.push(bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8);
    for (let y = top; y < top + rows; y++) {
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = bx * 8 + bit;
          if (x >= width) continue;
          const i = (y * width + x) * 4;
          const alpha = pixels[i + 3] / 255;
          // الشفاف = أبيض (خلفية الورق).
          const lum =
            255 -
            alpha *
              (255 -
                (pixels[i] * 299 + pixels[i + 1] * 587 + pixels[i + 2] * 114) /
                  1000);
          if (lum < THRESHOLD) byte |= 0x80 >> bit;
        }
        out.push(byte);
      }
    }
  }

  out.push(ESC, 0x64, Math.max(0, Math.min(opts.feedLines, 20))); // تغذية قبل القص
  if (opts.cut) out.push(GS, 0x56, 0x42, 0x00); // قص جزئي
  return Uint8Array.from(out);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
