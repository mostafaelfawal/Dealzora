import type { Metadata } from "next";
import "./globals.css";
import Provider from "@/store/Provider";
import { Toaster } from "react-hot-toast";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "StyleHub | نظام ERP لإدارة جميع أنواع المتاجر",
  description:
    "StyleHub هو نظام متكامل لإدارة المبيعات والمخزون والموظفين والعملاء لجميع أنواع المتاجر — من الملابس والإلكترونيات إلى المطاعم والصيدليات. واجهة سهلة، إدارة دقيقة، وتقارير فورية لتحقيق أقصى نمو لمتجرك.",
  keywords: [
    "StyleHub",
    "إدارة المتاجر",
    "نظام ERP",
    "نظام POS",
    "نظام مبيعات",
    "إدارة المخزون",
    "نقطة بيع",
    "إدارة العملاء",
    "إدارة الموظفين",
    "نظام محاسبة",
    "برنامج إدارة متجر",
    "برنامج محاسبي",
    "نظام ERP عربي",
    "Next.js",
    "Firebase",
  ],
  authors: [{ name: "Mostafa Hamdi" }],
  creator: "Mostafa Hamdi",
  metadataBase: new URL("https://0style-hub.vercel.app/"),
  openGraph: {
    title: "StyleHub | نظام شامل لإدارة المتاجر والمبيعات",
    description:
      "منصة متقدمة لإدارة المبيعات والمخزون والعملاء في جميع أنواع المتاجر. تحكم في متجرك بذكاء باستخدام StyleHub المبني على Next.js وFirebase.",
    url: "https://0style-hub.vercel.app/",
    siteName: "StyleHub",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "https://0style-hub.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "StyleHub – نظام إدارة المتاجر والمبيعات",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StyleHub | نظام ذكي لإدارة جميع أنواع المتاجر",
    description:
      "نظّم متجرك مع StyleHub — نظام ERP + POS متكامل لإدارة المبيعات والمخزون والموظفين والعملاء بسهولة واحترافية.",
    creator: "@MostafaHam37654",
  },
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        <Provider>
          <AuthGuard>{children}</AuthGuard>
          <Toaster position="bottom-left" />
        </Provider>
      </body>
    </html>
  );
}
