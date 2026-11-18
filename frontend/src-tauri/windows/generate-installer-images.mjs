// يولّد صور مُثبّت NSIS بهوية Dealzora (ألوان app/globals.css + الشعار).
// التشغيل من مجلد frontend:  node src-tauri/windows/generate-installer-images.mjs
//
// المخرجات (BMP 24-bit لأن NSIS لا يقبل غيره):
//   sidebar.bmp  164x314  صفحتا الترحيب والإنهاء (MUI_WELCOMEFINISHPAGE_BITMAP)
//   header.bmp   150x57   رأس بقية الصفحات (MUI_HEADERIMAGE_BITMAP)
// نرسم بضعف الدقة ثم نصغّر حتى تبقى حواف الشعار ناعمة.

import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const FULL_LOGO = join(root, "public/logo/full_logo_light.png"); // أبيض على داكن

// ألوان globals.css (oklch → sRGB)
const BG = [10, 10, 10]; // --background (dark) oklch(0.145 0 0)
const CARD = [23, 23, 23]; // --card (dark) oklch(0.205 0 0)
const WHITE = [255, 255, 255];
const MUTED = [161, 161, 161]; // --muted-foreground (dark) oklch(0.708 0 0)
const INK = [10, 10, 10]; // --foreground (light)

const SCALE = 3;

/** قناع ألفا من شعار أبيض على خلفية داكنة: الإضاءة تتحول إلى شفافية. */
async function loadMask(file) {
  const { data, info } = await sharp(file)
    .flatten({ background: "#000" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // الخلفية في الملف ليست سوداء تماماً (~#111) فنطرحها ونمدّ المدى.
  const bg = 40;
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = Math.max(0, Math.min(255, Math.round(((data[i] - bg) * 255) / (235 - bg))));
  }
  return { data: out, width: info.width, height: info.height };
}

/** يفصل العلامة (الحقيبة) عن الكلمة (Dealzora) بأعرض عمود فارغ بينهما. */
function splitMarkAndWord(mask) {
  const { data, width, height } = mask;
  const filled = [];
  for (let x = 0; x < width; x++) {
    let on = false;
    for (let y = 0; y < height && !on; y++) on = data[y * width + x] > 60;
    filled.push(on);
  }
  const first = filled.indexOf(true);
  const last = filled.lastIndexOf(true);
  let best = { start: 0, len: 0 };
  for (let x = first, run = 0; x <= last; x++) {
    run = filled[x] ? 0 : run + 1;
    if (run > best.len) best = { start: x - run + 1, len: run };
  }
  return { markRange: [first, best.start], wordRange: [best.start + best.len, last + 1] };
}

/** يقص عموديًا/أفقيًا ويعيد طبقة RGBA بلون واحد وألفا من القناع، مقصوصة على المحتوى. */
async function tintedLayer(mask, [x0, x1], color, targetHeight) {
  const w = x1 - x0;
  const rgba = Buffer.alloc(w * mask.height * 4);
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      rgba[o] = color[0];
      rgba[o + 1] = color[1];
      rgba[o + 2] = color[2];
      rgba[o + 3] = mask.data[y * mask.width + x0 + x];
    }
  }
  const trimmed = await sharp(rgba, { raw: { width: w, height: mask.height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toBuffer();
  return sharp(trimmed).resize({ height: targetHeight }).png().toBuffer({ resolveWithObject: true });
}

/** كتابة BMP 24-bit (bottom-up، صفوف مبطنة إلى 4 بايت). */
function writeBmp(file, rgb, width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowSize * height;
  const buf = Buffer.alloc(54 + pixelBytes);
  buf.write("BM", 0);
  buf.writeUInt32LE(54 + pixelBytes, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelBytes, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  for (let y = 0; y < height; y++) {
    const dst = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 3;
      buf[dst + x * 3] = rgb[s + 2];
      buf[dst + x * 3 + 1] = rgb[s + 1];
      buf[dst + x * 3 + 2] = rgb[s];
    }
  }
  writeFileSync(file, buf);
}

async function toBmp(pipeline, width, height, file) {
  const rgb = await pipeline
    .resize(width, height, { kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer();
  writeBmp(file, rgb, width, height);
}

const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

async function sidebar(mask, ranges) {
  const W = 164 * SCALE;
  const H = 314 * SCALE;
  const mark = await tintedLayer(mask, ranges.markRange, WHITE, 64 * SCALE);
  const word = await tintedLayer(mask, ranges.wordRange, WHITE, 19 * SCALE);

  // خلفية: تدرّج بين --background و--card، توهّج رمادي خافت خلف الشعار،
  // وخطوط شبكة دقيقة تحاكي أسطح التطبيق، وخط فاصل رفيع أعلى التذييل.
  const bgSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${hex(CARD)}"/>
        <stop offset="1" stop-color="${hex(BG)}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.36" r="0.55">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.09"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="${14 * SCALE}" height="${14 * SCALE}" patternUnits="userSpaceOnUse">
        <path d="M ${14 * SCALE} 0 L 0 0 0 ${14 * SCALE}" fill="none" stroke="#ffffff" stroke-opacity="0.035" stroke-width="${SCALE * 0.6}"/>
      </pattern>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0"/>
        <stop offset="0.75" stop-color="#000" stop-opacity="0.55"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" fill="url(#grid)"/>
    <rect width="100%" height="100%" fill="url(#fade)"/>
    <rect width="100%" height="100%" fill="url(#glow)"/>
    <rect x="${24 * SCALE}" y="${262 * SCALE}" width="${W - 48 * SCALE}" height="${SCALE * 0.7}" fill="#ffffff" fill-opacity="0.12"/>
    <text x="${W / 2}" y="${282 * SCALE}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
          font-size="${8.5 * SCALE}" letter-spacing="${1.6 * SCALE}" fill="${hex(MUTED)}">POINT OF SALE</text>
  </svg>`;

  const markLeft = Math.round((W - mark.info.width) / 2);
  const markTop = 82 * SCALE;
  const wordLeft = Math.round((W - word.info.width) / 2);
  const wordTop = markTop + mark.info.height + 20 * SCALE;

  const img = sharp(Buffer.from(bgSvg)).composite([
    { input: mark.data, left: markLeft, top: markTop },
    { input: word.data, left: wordLeft, top: wordTop },
  ]);
  await toBmp(sharp(await img.png().toBuffer()), 164, 314, join(here, "sidebar.bmp"));
}

async function header(mask, ranges) {
  // رأس الصفحات خلفيته بيضاء في MUI: الشعار الكامل بلون --foreground، محاذى لحافة الصورة.
  const W = 150 * SCALE;
  const H = 57 * SCALE;
  const mark = await tintedLayer(mask, ranges.markRange, INK, 30 * SCALE);
  const word = await tintedLayer(mask, ranges.wordRange, INK, 13 * SCALE);
  const gap = 7 * SCALE;
  const total = mark.info.width + gap + word.info.width;
  const left = Math.round((W - total) / 2);
  const markTop = Math.round((H - mark.info.height) / 2);
  const wordTop = Math.round((H - word.info.height) / 2) + 2 * SCALE;
  const img = sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).composite([
    { input: mark.data, left, top: markTop },
    { input: word.data, left: left + mark.info.width + gap, top: wordTop },
  ]);
  await toBmp(sharp(await img.png().toBuffer()), 150, 57, join(here, "header.bmp"));
}

const mask = await loadMask(FULL_LOGO);
const ranges = splitMarkAndWord(mask);
await sidebar(mask, ranges);
await header(mask, ranges);
console.log("✓ sidebar.bmp, header.bmp →", here);
