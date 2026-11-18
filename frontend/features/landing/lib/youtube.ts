const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * يستخرج معرّف فيديو يوتيوب من أي صيغة شائعة:
 * youtube.com/watch?v=ID ، youtu.be/ID ، youtube.com/embed/ID ، youtube.com/shorts/ID ، youtube-nocookie.com/embed/ID
 * يرجع null لأي رابط غير صالح (فلا تظهر بطاقة لفيديو لا يعمل).
 */
export function getYoutubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (ID_PATTERN.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  let id: string | null = null;

  if (host === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (first === "embed" || first === "shorts" || first === "live")
      id = second ?? null;
  }

  return id && ID_PATTERN.test(id) ? id : null;
}

/** رابط التضمين بلا ملفات تتبع حتى يضغط الزائر تشغيل. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}

export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** ثوانٍ → «mm:ss» (أو «h:mm:ss» للفيديو الذي يتجاوز ساعة). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${sec}`
    : `${String(m).padStart(2, "0")}:${sec}`;
}

/** مدة ISO 8601 كما يرجعها يوتيوب (PT1H2M3S) → ثوانٍ، أو null إن لم تكن صالحة. */
export function parseIsoDuration(iso: string): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return null;
  const [, d, h, min, s] = m.map((v) => Number(v ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}
