import { cache } from "react";

import { formatDuration, parseIsoDuration } from "./youtube";

/**
 * مدد فيديوهات يوتيوب تُجلب وقت البناء (الموقع تصدير ثابت output: "export")، فتُحدَّث مع كل نشر.
 *
 * - إن وُجد YOUTUBE_API_KEY في بيئة البناء: YouTube Data API v3 (دفعة لكل 50 فيديو، الأدق).
 * - وإلا: قراءة المدة من صفحة الفيديو العامة (lengthSeconds) بلا أي مفتاح.
 * أي فشل (لا إنترنت، تغيّر الصفحة) لا يكسر البناء: البطاقة تظهر بلا مدة أو بالمدة اليدوية.
 */

const TIMEOUT_MS = 8000;
const CONCURRENCY = 6;

type Durations = Record<string, string>;

async function fetchText(
  url: string,
  init?: RequestInit,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      ...init,
      cache: "force-cache",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function viaDataApi(ids: string[], key: string): Promise<Durations> {
  const out: Durations = {};
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url =
      "https://www.googleapis.com/youtube/v3/videos?part=contentDetails" +
      `&id=${batch.join(",")}&key=${encodeURIComponent(key)}`;
    const body = await fetchText(url);
    if (!body) continue;
    try {
      const data = JSON.parse(body) as {
        items?: { id: string; contentDetails?: { duration?: string } }[];
      };
      for (const item of data.items ?? []) {
        const seconds = parseIsoDuration(item.contentDetails?.duration ?? "");
        if (seconds) out[item.id] = formatDuration(seconds);
      }
    } catch {
      // استجابة غير متوقعة: نكمل بلا مدد لهذه الدفعة.
    }
  }
  return out;
}

async function viaWatchPage(id: string): Promise<string | null> {
  const html = await fetchText(`https://www.youtube.com/watch?v=${id}&hl=en`, {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
      // يتجاوز صفحة الموافقة على ملفات الارتباط في بعض المناطق.
      Cookie: "CONSENT=YES+1",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    },
  });
  if (!html) return null;

  const seconds = /"lengthSeconds":"(\d+)"/.exec(html)?.[1];
  if (seconds) return formatDuration(Number(seconds));

  const iso = /itemprop="duration" content="([^"]+)"/.exec(html)?.[1];
  const parsed = iso ? parseIsoDuration(iso) : null;
  return parsed ? formatDuration(parsed) : null;
}

async function viaWatchPages(ids: string[]): Promise<Durations> {
  const out: Durations = {};
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(viaWatchPage));
    batch.forEach((id, j) => {
      const d = results[j];
      if (d) out[id] = d;
    });
  }
  return out;
}

/** معرّف الفيديو → مدته «mm:ss». مخزّنة لكل عملية عرض (الرئيسية وصفحة الشروحات تشتركان). */
export const getYoutubeDurations = cache(
  async (ids: readonly string[]): Promise<Durations> => {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return {};
    const key = process.env.YOUTUBE_API_KEY;
    const fromApi = key ? await viaDataApi(unique, key) : {};
    const missing = unique.filter((id) => !fromApi[id]);
    return missing.length > 0
      ? { ...fromApi, ...(await viaWatchPages(missing)) }
      : fromApi;
  },
);
