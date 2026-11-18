import type { Metadata, Viewport } from "next";
import { Geist_Mono, IBM_Plex_Sans_Arabic } from "next/font/google";

import { THEME_SCRIPT } from "@/components/themeToggle";

import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const SITE = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "متاجر Dealzora", template: "%s" },
  description: "متاجر إلكترونية للمحلات بالدفع عند الاستلام.",
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${arabic.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
