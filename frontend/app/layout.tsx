import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Geist_Mono } from "next/font/google";

import "./globals.css";

import { cn } from "@/lib/utils";
import { AppProviders } from "@/providers/AppProviders";

// ========================================
// Constants
// ========================================

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
const SITE_NAME = "Dealzora";
const CREATOR_NAME = "Mostafa Hamdi";

const SITE_TITLE = "Dealzora | نظام إدارة المبيعات والمخزون ونقاط البيع POS";
const SITE_DESCRIPTION =
  "Dealzora هو نظام متكامل لإدارة المبيعات والمخزون والمشتريات والعملاء والموردين ونقاط البيع POS. تحكم في عملياتك التجارية، تابع مخزونك، وأدر فواتيرك وتقاريرك من منصة واحدة.";

// ========================================
// Fonts
// ========================================

const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

// ========================================
// SEO Metadata
// ========================================

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",

  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },

  description: SITE_DESCRIPTION,

  keywords: [
    "Dealzora",
    "إدارة المبيعات",
    "إدارة المخزون",
    "نظام نقاط البيع",
    "برنامج كاشير",
    "برنامج محاسبة",
    "برنامج حسابات ومبيعات",
    "نظام إدارة المحلات",
    "برنامج إدارة المخازن",
    "برنامج فواتير",
    "POS System",
    "ERP System",
    "Sales Management",
    "Inventory Management",
    "Purchases Management",
    "Retail Management",
    "Point of Sale",
    "Invoicing Software",
  ],

  authors: [{ name: CREATOR_NAME }, { name: SITE_NAME, url: SITE_URL }],
  creator: CREATOR_NAME,
  publisher: SITE_NAME,

  category: "Business Software",
  classification: "Business / Sales & Inventory Management",

  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },

  alternates: {
    canonical: "/",
    languages: {
      "ar-EG": "/",
      "x-default": "/",
    },
  },

  openGraph: {
    type: "website",
    url: "/",
    locale: "ar_EG",
    siteName: SITE_NAME,
    title: "Dealzora | إدارة أعمالك من مكان واحد",
    description:
      "منصة متكاملة لإدارة المبيعات والمخزون والمشتريات ونقاط البيع POS. نظّم عملياتك التجارية واتخذ قرارات أفضل.",
    // حط صورة 1200x630 في app/opengraph-image.png وهتتضاف أوتوماتيك
    // أو عرّفها هنا يدوي:
    // images: [{ url: "/og.png", width: 1200, height: 630, alt: "Dealzora" }],
  },

  twitter: {
    card: "summary_large_image",
    title: "Dealzora | نظام إدارة المبيعات والمخزون",
    description: "أدر مبيعاتك ومخزونك ومشترياتك ونقاط البيع من منصة واحدة.",
    creator: CREATOR_NAME,
    // images: ["/og.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  // icons: {
  //   icon: "/favicon.ico",
  //   apple: "/apple-touch-icon.png",
  // },
  // manifest: "/manifest.webmanifest",

  // verification: {
  //   google: "GOOGLE_SEARCH_CONSOLE_CODE",
  //   other: { "msvalidate.01": "BING_CODE" },
  // },

  other: {
    "created-by": CREATOR_NAME,
    author: CREATOR_NAME,
  },
};

// ========================================
// Viewport & Theme
// ========================================

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#ffffff",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#09090b",
    },
  ],
  colorScheme: "light dark",
};

// ========================================
// Structured Data (JSON-LD)
// ========================================

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "ar-EG",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      founder: {
        "@type": "Person",
        name: CREATOR_NAME,
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: SITE_NAME,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Windows",
      description: SITE_DESCRIPTION,
      inLanguage: "ar-EG",
      creator: {
        "@type": "Person",
        name: CREATOR_NAME,
      },
    },
  ],
};

// ========================================
// Root Layout
// ========================================

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        arabicFont.variable,
        geistMono.variable,
      )}
    >
      {/* Created by Mostafa Hamdi */}
      <body className="min-h-full flex flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
