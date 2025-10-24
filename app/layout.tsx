import type { Metadata } from "next";
import "./globals.css";
import Provider from "@/store/Provider";
import { Toaster } from "react-hot-toast";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "Dealzora | نظام ERP لإدارة جميع أنواع المتاجر",
  description:
    "Dealzora هو نظام متكامل لإدارة المبيعات والمخزون والموظفين والعملاء لجميع أنواع المتاجر — من الملابس والإلكترونيات إلى المطاعم والصيدليات. واجهة سهلة، إدارة دقيقة، وتقارير فورية لتحقيق أقصى نمو لمتجرك.",
  keywords: [
    "Dealzora",
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
  metadataBase: new URL("https:/dealzora.vercel.app/"),
  openGraph: {
    title: "Dealzora | نظام شامل لإدارة المتاجر والمبيعات",
    description:
      "منصة متقدمة لإدارة المبيعات والمخزون والعملاء في جميع أنواع المتاجر. تحكم في متجرك بذكاء باستخدام Dealzora المبني على Next.js وFirebase.",
    url: "https:/dealzora.vercel.app/",
    siteName: "Dealzora",
    locale: "ar_EG",
    type: "website",
    images: [
      {
        url: "https:/dealzora.vercel.app/favicon.png",
        width: 1200,
        height: 630,
        alt: "Dealzora – نظام إدارة المتاجر والمبيعات",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dealzora | نظام ذكي لإدارة جميع أنواع المتاجر",
    description:
      "نظّم متجرك مع Dealzora — نظام ERP + POS متكامل لإدارة المبيعات والمخزون والموظفين والعملاء بسهولة واحترافية.",
    creator: "@MostafaHam37654",
  },
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        <Provider>
          {children}
          <Toaster position="bottom-left" />
        </Provider>
      </body>
    </html>
  );
}
