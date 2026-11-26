import {
  siFacebook,
  siInstagram,
  siTiktok,
  siWhatsapp,
  siX,
  siYoutube,
  type SimpleIcon,
} from "simple-icons";

/**
 * إعدادات صفحة Dealzora التعريفية في مكان واحد.
 * كل قيمة فارغة هنا تعني «غير متاح بعد»: الصفحة تخفي الزر أو تعرض حالة «غير متاح» تلقائياً،
 * فلا يظهر للزائر رابط معطّل أو بيانات غير حقيقية.
 */

// ========================================
// التنقل
// ========================================

export const NAV_LINKS = [
  { href: "/#top", label: "الرئيسية" },
  { href: "/#features", label: "المميزات" },
  { href: "/tutorials", label: "الشروحات" },
  { href: "/#pricing", label: "الباقات والأسعار" },
  { href: "/#download", label: "التحميل" },
  { href: "/#contact", label: "تواصل معنا" },
] as const;

// ========================================
// التواصل الاجتماعي
// ========================================

export interface SocialLink {
  name: string;
  /** الاسم المقروء لقارئ الشاشة. */
  label: string;
  icon: SimpleIcon;
  url: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    name: "WhatsApp Group",
    label: "مجتمع Dealzora على واتساب",
    icon: siWhatsapp,
    url: "https://chat.whatsapp.com/FCKYptydOcOEMrUb7bTTxt",
  },
  {
    name: "Facebook",
    label: "صفحة Dealzora على فيسبوك",
    icon: siFacebook,
    url: "https://www.facebook.com/profile.php?id=61596279460515",
  },
  {
    name: "Instagram",
    label: "حساب Dealzora على إنستغرام",
    icon: siInstagram,
    url: "https://www.instagram.com/_dealzora_",
  },
  {
    name: "YouTube",
    label: "قناة Dealzora على يوتيوب",
    icon: siYoutube,
    url: "https://www.youtube.com/@dealzora-s",
  },
  {
    name: "TikTok",
    label: "حساب Dealzora على تيك توك",
    icon: siTiktok,
    url: "https://www.tiktok.com/@_dealzora_",
  },
  {
    name: "X",
    label: "حساب Dealzora على إكس",
    icon: siX,
    url: "https://x.com/_dealzora_",
  },
];

export const WHATSAPP_COMMUNITY_URL = SOCIAL_LINKS[0].url;

/** رقم التواصل الهاتفي بالصيغة الدولية (E.164) لرابط tel:. */
export const CONTACT_PHONE = "+201039782708";
export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@dealzora-s";

// ========================================
// التحميل
// ========================================

export type PlatformId = "windows" | "linux" | "macos" | "android" | "ios";

/** نسخة بديلة من نفس المنصة (مثل ماك Apple Silicon وماك Intel): زر لكل واحدة. */
export interface DownloadVariant {
  label: string;
  /** وصف قصير يساعد الزائر على اختيار النسخة المناسبة لجهازه. */
  hint?: string;
  url: string;
}

export interface DownloadConfig {
  version?: string;
  url?: string;
  /** عند وجودها تُعرض أزرارها بدل زر url الواحد. */
  variants?: DownloadVariant[];
  /** صيغة الملف كما يظهر للزائر. */
  fileType: string;
  /** الزر يعمل فقط عندما تكون true ويوجد url. */
  available: boolean;
}

/**
 * نسخة برنامج الكمبيوتر الحالية. عند نشر إصدار جديد (release-desktop.yml) حدّث هذا الرقم فقط:
 * روابط ويندوز ولينكس وماك تُبنى منه بأسماء الملفات التي يرفعها tauri-action.
 */
export const DESKTOP_VERSION = "1.0.10";

const RELEASE_FILES = `https://github.com/mostafaelfawal/Dealzora/releases/download/v${DESKTOP_VERSION}`;

/** روابط التحميل الحقيقية من إصدارات GitHub (نفس مصدر التحديث التلقائي في tauri.conf.json). */
export const DOWNLOADS = {
  windows: {
    version: DESKTOP_VERSION,
    url: `${RELEASE_FILES}/dealzora_${DESKTOP_VERSION}_x64-setup.exe`,
    fileType: "exe (64-bit)",
    available: true,
  },
  linux: {
    version: DESKTOP_VERSION,
    url: `${RELEASE_FILES}/dealzora_${DESKTOP_VERSION}_amd64.AppImage`,
    fileType: "AppImage (64-bit)",
    available: true,
  },
  macos: {
    version: DESKTOP_VERSION,
    url: `${RELEASE_FILES}/dealzora_${DESKTOP_VERSION}_aarch64.dmg`,
    variants: [
      {
        label: "Apple Silicon",
        hint: "أجهزة M1 وما بعدها",
        url: `${RELEASE_FILES}/dealzora_${DESKTOP_VERSION}_aarch64.dmg`,
      },
      {
        label: "Intel",
        hint: "أجهزة ماك الأقدم بمعالج Intel",
        url: `${RELEASE_FILES}/dealzora_${DESKTOP_VERSION}_x64.dmg`,
      },
    ],
    fileType: "dmg",
    available: true,
  },
  android: {
    version: "1.0.0",
    url: "",
    fileType: "apk",
    available: true,
  },
  ios: {
    // رابط نسخة الويب (PWA) عند نشرها. لا يوجد تطبيق على App Store.
    url: "https://dealzora-app.vercel.app",
    fileType: "PWA",
    available: true,
  },
} satisfies Record<PlatformId, DownloadConfig>;

/** صفحة كل الإصدارات وملاحظاتها. */
export const RELEASES_URL =
  "https://github.com/mostafaelfawal/Dealzora/releases";

export function isDownloadReady(d: DownloadConfig): d is DownloadConfig & {
  url: string;
} {
  return d.available && Boolean(d.url);
}

// ========================================
// لقطات الشاشة
// ========================================

export interface Screenshot {
  id: string;
  title: string;
  caption: string;
  /**
   * مسار الصورة داخل public (مثلاً "/landing/screens/pos.png").
   * اتركه فارغاً حتى تتوفر لقطة حقيقية: يظهر إطار محايد بدل صورة مختلَقة.
   */
  src?: string;
  /** أبعاد الصورة الأصلية لحفظ النسبة ومنع إزاحة التخطيط. */
  width: number;
  height: number;
}

export const SCREENSHOTS: Screenshot[] = [
  {
    id: "pos",
    src: "/landing_screens/pos.png",
    title: "نقطة البيع",
    caption: "شاشة الكاشير: بحث وباركود وتحصيل سريع وطباعة الإيصال.",
    width: 1280,
    height: 800,
  },
  {
    id: "dashboard",
    src: "/landing_screens/dashboard.png",
    title: "الرئيسية",
    caption: "مبيعات اليوم وصافي الربح والتنبيهات في نظرة واحدة.",
    width: 1280,
    height: 800,
  },
  {
    id: "products",
    src: "/landing_screens/products.png",
    title: "المنتجات",
    caption: "الأصناف بالباركود والأقسام والوحدات وأسعار البيع والشراء.",
    width: 1280,
    height: 800,
  },
  {
    id: "reports",
    src: "/landing_screens/reports.png",
    title: "التقارير",
    caption: "تقارير المبيعات والأصناف والمخزون والخزنة والديون.",
    width: 1280,
    height: 800,
  },
];
