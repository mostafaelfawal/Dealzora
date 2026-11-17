import type { Metadata } from "next";

import "@/features/landing/landing.css";

import { ChallengesSection } from "@/features/landing/components/challengesSection";
import { ContactSection } from "@/features/landing/components/contactSection";
import { DesktopRedirect } from "@/features/landing/components/desktopRedirect";
import { DownloadSection } from "@/features/landing/components/downloadSection";
import { HeroSection } from "@/features/landing/components/heroSection";
import { LandingFooter } from "@/features/landing/components/landingFooter";
import { LandingHeader } from "@/features/landing/components/landingHeader";
import { ModulesSection } from "@/features/landing/components/modulesSection";
import { PricingSection } from "@/features/landing/components/pricingSection";
import { ShowcaseSection } from "@/features/landing/components/showcaseSection";
import {
  FaqSection,
  WhySection,
} from "@/features/landing/components/trustSections";
import { TutorialsSection } from "@/features/landing/components/tutorialsSection";

const TITLE = "Dealzora | برنامج كاشير وإدارة المحلات والمخزون";
const DESCRIPTION =
  "Dealzora برنامج عربي لإدارة المحلات التجارية: نقطة بيع بالباركود، والمخزون، والمشتريات، والعملاء والموردين، والخزنة والتقارير. يعمل على جهازك دون إنترنت، مع خطة مجانية.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "برنامج كاشير",
    "برنامج نقاط بيع",
    "برنامج إدارة محلات",
    "برنامج مخازن",
    "برنامج سوبر ماركت",
    "برنامج حسابات للمحلات",
    "برنامج باركود",
    "Dealzora",
    "POS",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    locale: "ar_EG",
    siteName: "Dealzora",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/logo/logo.png", width: 512, height: 512, alt: "Dealzora" }],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/logo/logo.png"],
  },
};

export default function LandingPage() {
  return (
    <>
      {/* برنامج الكمبيوتر: تحويل فوري إلى لوحة التحكم بـ isTauri() (سكربت الإخفاء في app/layout.tsx). */}
      <DesktopRedirect />
      <div className="landing-root flex min-h-full flex-col">
        <LandingHeader />
        <main id="main" className="flex-1">
          <HeroSection />
          <ChallengesSection />
          <ModulesSection />
          <ShowcaseSection />
          <TutorialsSection />
          <PricingSection />
          <DownloadSection />
          <WhySection />
          <FaqSection />
          <ContactSection />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
