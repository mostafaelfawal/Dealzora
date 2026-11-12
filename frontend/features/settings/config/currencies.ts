import type { Currency } from "@/lib/currency";

/** عملات الدول العربية (الرمز ISO 4217 + الاختصار الشائع محلياً). "أخرى" يكتبها المدير. */
/** iso = رمز الدولة (ISO 3166) لقوالب طرق الدفع. */
export const ARAB_CURRENCIES: (Currency & { country: string; iso: string })[] =
  [
    {
      iso: "EG",
      code: "EGP",
      symbol: "ج.م",
      name: "جنيه مصري",
      country: "مصر",
    },
    {
      iso: "SA",
      code: "SAR",
      symbol: "ر.س",
      name: "ريال سعودي",
      country: "السعودية",
    },
    {
      iso: "AE",
      code: "AED",
      symbol: "د.إ",
      name: "درهم إماراتي",
      country: "الإمارات",
    },
    {
      iso: "KW",
      code: "KWD",
      symbol: "د.ك",
      name: "دينار كويتي",
      country: "الكويت",
    },
    {
      iso: "QA",
      code: "QAR",
      symbol: "ر.ق",
      name: "ريال قطري",
      country: "قطر",
    },
    {
      iso: "BH",
      code: "BHD",
      symbol: "د.ب",
      name: "دينار بحريني",
      country: "البحرين",
    },
    {
      iso: "OM",
      code: "OMR",
      symbol: "ر.ع",
      name: "ريال عماني",
      country: "عُمان",
    },
    {
      iso: "JO",
      code: "JOD",
      symbol: "د.أ",
      name: "دينار أردني",
      country: "الأردن",
    },
    {
      iso: "IQ",
      code: "IQD",
      symbol: "د.ع",
      name: "دينار عراقي",
      country: "العراق",
    },
    {
      iso: "SY",
      code: "SYP",
      symbol: "ل.س",
      name: "ليرة سورية",
      country: "سوريا",
    },
    {
      iso: "LB",
      code: "LBP",
      symbol: "ل.ل",
      name: "ليرة لبنانية",
      country: "لبنان",
    },
    { iso: "PS", code: "ILS", symbol: "₪", name: "شيكل", country: "فلسطين" },
    {
      iso: "YE",
      code: "YER",
      symbol: "ر.ي",
      name: "ريال يمني",
      country: "اليمن",
    },
    {
      iso: "SD",
      code: "SDG",
      symbol: "ج.س",
      name: "جنيه سوداني",
      country: "السودان",
    },
    {
      iso: "LY",
      code: "LYD",
      symbol: "د.ل",
      name: "دينار ليبي",
      country: "ليبيا",
    },
    {
      iso: "TN",
      code: "TND",
      symbol: "د.ت",
      name: "دينار تونسي",
      country: "تونس",
    },
    {
      iso: "DZ",
      code: "DZD",
      symbol: "د.ج",
      name: "دينار جزائري",
      country: "الجزائر",
    },
    {
      iso: "MA",
      code: "MAD",
      symbol: "د.م",
      name: "درهم مغربي",
      country: "المغرب",
    },
    {
      iso: "MR",
      code: "MRU",
      symbol: "أ.م",
      name: "أوقية موريتانية",
      country: "موريتانيا",
    },
    {
      iso: "SO",
      code: "SOS",
      symbol: "ش.ص",
      name: "شلن صومالي",
      country: "الصومال",
    },
    {
      iso: "DJ",
      code: "DJF",
      symbol: "ف.ج",
      name: "فرنك جيبوتي",
      country: "جيبوتي",
    },
    {
      iso: "KM",
      code: "KMF",
      symbol: "ف.ق",
      name: "فرنك قمري",
      country: "جزر القمر",
    },
  ];

export const OTHER_CURRENCY = "other";

/** نفس حدود الـ backend (settings/constants.py). */
export const CURRENCY_LIMITS = { code: 8, symbol: 8, name: 40 };
