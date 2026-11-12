import type { PaymentKind } from "@/lib/payments";

import { ARAB_CURRENCIES } from "./currencies";

/**
 * قوالب طرق الدفع الشائعة في كل دولة عربية (نفس دول قائمة العملات).
 * القالب مجرد اقتراح: المدير يفعّل ما يستخدمه ويكتب رقم حسابه، ويضيف أي طريقة أخرى يدوياً.
 * المعرّف (id) يُخزَّن في الفواتير، فلا يُغيَّر بعد الإطلاق.
 */
export interface PaymentTemplate {
  id: string;
  name: string;
  kind: PaymentKind;
  /** مثال لما يُكتب في خانة الحساب. null = لا يحتاج حساباً (نقطة بيع). */
  accountHint: string | null;
}

const POS: PaymentTemplate = {
  id: "card_pos",
  name: "بطاقة بنكية (نقطة بيع)",
  kind: "card",
  accountHint: null,
};
const APPLE_PAY: PaymentTemplate = {
  id: "apple_pay",
  name: "Apple Pay",
  kind: "card",
  accountHint: null,
};
const BANK: PaymentTemplate = {
  id: "bank_transfer",
  name: "تحويل بنكي",
  kind: "transfer",
  accountHint: "رقم الحساب أو IBAN",
};

const wallet = (id: string, name: string, hint = "رقم المحفظة") => ({
  id,
  name,
  kind: "wallet" as const,
  accountHint: hint,
});
const transfer = (id: string, name: string, hint: string) => ({
  id,
  name,
  kind: "transfer" as const,
  accountHint: hint,
});
const card = (id: string, name: string) => ({
  id,
  name,
  kind: "card" as const,
  accountHint: null,
});

export const PAYMENT_TEMPLATES: Record<string, PaymentTemplate[]> = {
  EG: [
    wallet("vodafone_cash", "فودافون كاش", "010xxxxxxxx"),
    transfer("instapay", "إنستاباي", "shop@instapay أو رقم الموبايل"),
    wallet("orange_cash", "أورنج كاش", "012xxxxxxxx"),
    wallet("etisalat_cash", "اتصالات كاش", "011xxxxxxxx"),
    wallet("we_pay", "WE Pay", "015xxxxxxxx"),
    POS,
  ],
  SA: [
    card("mada", "مدى"),
    wallet("stc_pay", "STC Pay", "05xxxxxxxx"),
    APPLE_PAY,
    transfer("sarie", "تحويل فوري (سريع)", "IBAN أو رقم الجوال"),
  ],
  AE: [
    POS,
    APPLE_PAY,
    transfer("aani", "آني (Aani)", "رقم الجوال أو IBAN"),
    BANK,
  ],
  KW: [
    card("knet", "كي نت (KNET)"),
    transfer("wamd", "ومض (WAMD)", "رقم الهاتف"),
    APPLE_PAY,
  ],
  QA: [
    POS,
    transfer("fawran", "فورا (Fawran)", "رقم الجوال أو IBAN"),
    APPLE_PAY,
  ],
  BH: [
    card("benefit", "بنفت (نقطة بيع)"),
    wallet("benefit_pay", "بنفت باي (BenefitPay)", "رقم الهاتف"),
    APPLE_PAY,
  ],
  OM: [POS, transfer("mobile_pay", "الدفع عبر الهاتف", "رقم الهاتف"), BANK],
  JO: [
    transfer("cliq", "كليك (CliQ)", "الاسم المستعار (Alias) أو رقم الهاتف"),
    wallet("zain_cash", "زين كاش", "07xxxxxxxx"),
    wallet("orange_money", "أورنج موني", "07xxxxxxxx"),
    POS,
  ],
  IQ: [
    wallet("zain_cash", "زين كاش", "07xxxxxxxxx"),
    card("qi_card", "كي كارد (Qi Card)"),
    wallet("fastpay", "فاست باي (FastPay)", "07xxxxxxxxx"),
    wallet("asia_hawala", "آسيا حوالة", "07xxxxxxxxx"),
  ],
  SY: [
    wallet("sham_cash", "شام كاش"),
    wallet("syriatel_cash", "سيرياتيل كاش", "09xxxxxxxx"),
    wallet("mtn_cash", "MTN كاش", "09xxxxxxxx"),
  ],
  LB: [
    wallet("whish", "Whish Money", "رقم الهاتف"),
    wallet("omt_pay", "OMT Pay", "رقم الهاتف"),
    POS,
  ],
  PS: [
    wallet("jawwal_pay", "جوال باي", "059xxxxxxx"),
    wallet("palpay", "بال باي (PalPay)", "رقم الهاتف"),
    POS,
  ],
  YE: [
    wallet("jaib", "جيب"),
    wallet("floosak", "فلوسك"),
    wallet("one_cash", "ون كاش"),
    wallet("mobile_money", "موبايل موني"),
  ],
  SD: [
    transfer("bankak", "بنكك", "رقم الحساب"),
    wallet("ocash", "أوكاش (O-Cash)"),
    transfer("fawry_sd", "فوري", "رقم الحساب"),
  ],
  LY: [
    card("tadawul", "بطاقة مصرفية (نقطة بيع)"),
    wallet("sadad", "سداد", "رقم الهاتف"),
    wallet("mobicash", "موبي كاش", "رقم الهاتف"),
  ],
  TN: [
    wallet("d17", "D17", "رقم الهاتف"),
    wallet("flouci", "فلوسي (Flouci)", "رقم الهاتف"),
    POS,
  ],
  DZ: [
    transfer("baridimob", "بريدي موب", "RIP / رقم الحساب البريدي"),
    card("edahabia", "الذهبية (Edahabia)"),
    card("cib", "بطاقة CIB"),
  ],
  MA: [POS, wallet("cih_pay", "محفظة بنكية (M-Wallet)", "رقم الهاتف"), BANK],
  MR: [
    wallet("bankily", "بنكيلي", "رقم الهاتف"),
    wallet("masrvi", "مصرفي", "رقم الهاتف"),
    wallet("sedad_mr", "سداد", "رقم الهاتف"),
  ],
  SO: [
    wallet("evc_plus", "EVC Plus", "رقم الهاتف"),
    wallet("zaad", "زاد (Zaad)", "رقم الهاتف"),
    wallet("sahal", "سهل (Sahal)", "رقم الهاتف"),
  ],
  DJ: [
    wallet("waafi", "وافي (Waafi)", "رقم الهاتف"),
    wallet("d_money", "D-Money", "رقم الهاتف"),
  ],
  KM: [wallet("huri_money", "هوري موني", "رقم الهاتف"), POS],
};

export const PAYMENT_COUNTRIES = ARAB_CURRENCIES.filter(
  (c) => PAYMENT_TEMPLATES[c.iso],
).map((c) => ({ iso: c.iso, name: c.country, currency: c.code }));

/** دولة القوالب الافتراضية من عملة المحل (EGP ← مصر). */
export const countryForCurrency = (code: string) =>
  ARAB_CURRENCIES.find((c) => c.code === code)?.iso ?? null;

/** معرّف لطريقة يضيفها المدير يدوياً (يناسب حد الـ backend: 16 حرفاً). */
export const customMethodId = () =>
  `c_${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`;
