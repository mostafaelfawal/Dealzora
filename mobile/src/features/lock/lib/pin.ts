/**
 * القفل برمز سري (4–8 أرقام): بديل البصمة على أي هاتف، والوحيد المتاح في نسخة الويب (PWA على الآيفون).
 *
 * - الرمز لا يُحفظ أبداً: SHA-256 مكرر مع salt عشوائي لكل هاتف (في SecureStore، أو localStorage على الويب).
 * - التخمين: بعد 5 محاولات خاطئة انتظار يتضاعف (30 ث ← 15 دقيقة كحد أقصى)، وعند 10 خروج كامل من الحساب.
 * - الخروج من الحساب يمسح الرمز (مستخدم جديد على نفس الهاتف لا يُقفل برمز غيره).
 */
import * as Crypto from "expo-crypto";

import {
  SECURE_KEYS,
  secureDelete,
  secureGet,
  secureSet,
} from "@/lib/secureStore";

export const PIN_MIN = 4;
export const PIN_MAX = 8;
/** عدد المحاولات الخاطئة قبل بدء الانتظار، وقبل الخروج الكامل. */
export const FREE_TRIES = 5;
export const MAX_TRIES = 10;
const ROUNDS = 400;

interface StoredPin {
  salt: string;
  hash: string;
}

interface Fails {
  count: number;
  /** ms: لا محاولات قبل هذا الوقت. */
  until: number;
}

/* ---------- منطق بلا أجهزة (مُختبر) ---------- */

/** null = صالح، وإلا رسالة الخطأ. */
export function pinProblem(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return "أرقام فقط";
  if (pin.length < PIN_MIN || pin.length > PIN_MAX)
    return `من ${PIN_MIN} إلى ${PIN_MAX} أرقام`;
  if (/^(\d)\1+$/.test(pin)) return "رمز سهل التخمين: لا تكرر نفس الرقم";
  const asc = "01234567890123456789";
  const desc = "98765432109876543210";
  if (asc.includes(pin) || desc.includes(pin))
    return "رمز سهل التخمين: لا تستخدم أرقاماً متتالية";
  return null;
}

/** مدة الانتظار بعد عدد المحاولات الخاطئة (0 = لا انتظار). */
export function lockoutMs(count: number): number {
  if (count < FREE_TRIES) return 0;
  return Math.min(30_000 * 2 ** (count - FREE_TRIES), 15 * 60_000);
}

/* ---------- التخزين ---------- */

async function hashPin(pin: string, salt: string): Promise<string> {
  let h = `${salt}:${pin}`;
  for (let i = 0; i < ROUNDS; i++)
    h = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${salt}${h}`,
    );
  return h;
}

async function readPin(): Promise<StoredPin | null> {
  try {
    const raw = await secureGet(SECURE_KEYS.pin);
    return raw ? (JSON.parse(raw) as StoredPin) : null;
  } catch {
    return null;
  }
}

async function readFails(): Promise<Fails> {
  try {
    const raw = await secureGet(SECURE_KEYS.pinFails);
    return raw ? (JSON.parse(raw) as Fails) : { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}

/* ---------- حالة «يوجد رمز» لكل التطبيق ---------- */

let pinSet: boolean | null = null; // null = لم يُقرأ بعد
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const getPinSet = () => pinSet;

export function subscribePin(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadPinSet(): Promise<boolean> {
  if (pinSet === null) {
    pinSet = (await readPin()) !== null;
    notify();
  }
  return pinSet;
}

export async function savePin(pin: string): Promise<void> {
  const problem = pinProblem(pin);
  if (problem) throw new Error(problem);
  const salt = Crypto.randomUUID();
  const stored: StoredPin = { salt, hash: await hashPin(pin, salt) };
  await secureSet(SECURE_KEYS.pin, JSON.stringify(stored));
  await secureDelete(SECURE_KEYS.pinFails);
  pinSet = true;
  notify();
}

export async function clearPin(): Promise<void> {
  await Promise.all([
    secureDelete(SECURE_KEYS.pin),
    secureDelete(SECURE_KEYS.pinFails),
  ]).catch(() => undefined);
  pinSet = false;
  notify();
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "wrong"; left: number; waitMs: number }
  | { ok: false; reason: "wait"; waitMs: number }
  | { ok: false; reason: "wiped" };

/** يتحقق ويعدّ الأخطاء. wiped = تجاوز الحد: على المستدعي تسجيل الخروج. */
export async function verifyPin(
  pin: string,
  now = Date.now(),
): Promise<VerifyResult> {
  const fails = await readFails();
  if (fails.until > now)
    return { ok: false, reason: "wait", waitMs: fails.until - now };
  const stored = await readPin();
  if (!stored) return { ok: true }; // لا رمز (مُسح): لا شيء يُتحقق منه
  if ((await hashPin(pin, stored.salt)) === stored.hash) {
    await secureDelete(SECURE_KEYS.pinFails);
    return { ok: true };
  }
  const count = fails.count + 1;
  if (count >= MAX_TRIES) {
    await clearPin();
    return { ok: false, reason: "wiped" };
  }
  const waitMs = lockoutMs(count);
  await secureSet(
    SECURE_KEYS.pinFails,
    JSON.stringify({ count, until: waitMs ? now + waitMs : 0 }),
  );
  return { ok: false, reason: "wrong", left: MAX_TRIES - count, waitMs };
}
