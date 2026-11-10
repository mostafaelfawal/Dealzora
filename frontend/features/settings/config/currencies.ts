import type { Currency } from "@/lib/currency";

/** عملات الدول العربية (الرمز ISO 4217 + الاختصار الشائع محلياً). "أخرى" يكتبها المدير. */
export const ARAB_CURRENCIES: (Currency & { country: string })[] = [
  { code: "EGP", symbol: "ج.م", name: "جنيه مصري", country: "مصر" },
  { code: "SAR", symbol: "ر.س", name: "ريال سعودي", country: "السعودية" },
  { code: "AED", symbol: "د.إ", name: "درهم إماراتي", country: "الإمارات" },
  { code: "KWD", symbol: "د.ك", name: "دينار كويتي", country: "الكويت" },
  { code: "QAR", symbol: "ر.ق", name: "ريال قطري", country: "قطر" },
  { code: "BHD", symbol: "د.ب", name: "دينار بحريني", country: "البحرين" },
  { code: "OMR", symbol: "ر.ع", name: "ريال عماني", country: "عُمان" },
  { code: "JOD", symbol: "د.أ", name: "دينار أردني", country: "الأردن" },
  { code: "IQD", symbol: "د.ع", name: "دينار عراقي", country: "العراق" },
  { code: "SYP", symbol: "ل.س", name: "ليرة سورية", country: "سوريا" },
  { code: "LBP", symbol: "ل.ل", name: "ليرة لبنانية", country: "لبنان" },
  { code: "ILS", symbol: "₪", name: "شيكل", country: "فلسطين" },
  { code: "YER", symbol: "ر.ي", name: "ريال يمني", country: "اليمن" },
  { code: "SDG", symbol: "ج.س", name: "جنيه سوداني", country: "السودان" },
  { code: "LYD", symbol: "د.ل", name: "دينار ليبي", country: "ليبيا" },
  { code: "TND", symbol: "د.ت", name: "دينار تونسي", country: "تونس" },
  { code: "DZD", symbol: "د.ج", name: "دينار جزائري", country: "الجزائر" },
  { code: "MAD", symbol: "د.م", name: "درهم مغربي", country: "المغرب" },
  { code: "MRU", symbol: "أ.م", name: "أوقية موريتانية", country: "موريتانيا" },
  { code: "SOS", symbol: "ش.ص", name: "شلن صومالي", country: "الصومال" },
  { code: "DJF", symbol: "ف.ج", name: "فرنك جيبوتي", country: "جيبوتي" },
  { code: "KMF", symbol: "ف.ق", name: "فرنك قمري", country: "جزر القمر" },
];

export const OTHER_CURRENCY = "other";

/** نفس حدود الـ backend (settings/constants.py). */
export const CURRENCY_LIMITS = { code: 8, symbol: 8, name: 40 };
