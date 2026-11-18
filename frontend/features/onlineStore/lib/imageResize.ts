/**
 * ضغط الصورة في البرنامج قبل رفعها: أقصى ضلع MAX_SIDE، وصيغة WebP (أو JPEG لو المتصفح لا يدعمها)،
 * وجودة تنخفض تدريجياً حتى تقل عن MAX_BYTES. إعادة الرسم على canvas تحذف أيضاً أي بيانات مخفية
 * في الملف (EXIF والموقع الجغرافي).
 */

const MAX_SIDE = 1200;
const MAX_BYTES = 520_000;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export type CompressedImage = {
  contentType: "image/webp" | "image/jpeg";
  base64: string;
  previewUrl: string;
  bytes: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("الملف ليس صورة صالحة"));
    };
    img.src = url;
  });
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("تعذّر قراءة الصورة"));
    reader.readAsDataURL(blob);
  });
}

export async function compressImage(
  file: File,
  { square = false }: { square?: boolean } = {},
): Promise<CompressedImage> {
  if (!ACCEPTED.includes(file.type))
    throw new Error("اختر صورة بصيغة JPG أو PNG أو WebP");
  if (file.size > 20_000_000) throw new Error("الصورة أكبر من 20 ميجابايت");
  const img = await loadImage(file);

  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }
  const limit = square ? 512 : MAX_SIDE;
  const scale = Math.min(1, limit / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر تجهيز الصورة");
  // خلفية بيضاء: PNG الشفاف لا يظهر أسود بعد تحويله لـ JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  for (const type of ["image/webp", "image/jpeg"] as const) {
    for (const quality of [0.85, 0.75, 0.65, 0.5, 0.4]) {
      const blob = await toBlob(canvas, type, quality);
      if (!blob || blob.type !== type) break; // الصيغة غير مدعومة: جرّب التالية
      if (blob.size <= MAX_BYTES) {
        return {
          contentType: type,
          base64: await blobToBase64(blob),
          previewUrl: URL.createObjectURL(blob),
          bytes: blob.size,
        };
      }
    }
  }
  throw new Error("تعذّر تصغير الصورة بما يكفي. اختر صورة أبسط");
}
