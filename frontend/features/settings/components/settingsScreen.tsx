"use client";

import {
  IconBuildingStore,
  IconCoins,
  IconDatabaseExport,
  IconLicense,
  IconPalette,
  IconShieldLock,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/shared/PageHeader";

import { AppearanceSection } from "./appearanceSection";
import { BackupSection } from "./backupSection";
import { CurrencySection } from "./currencySection";
import { DemoDataSection } from "./demoDataSection";
import { LicenseSection } from "./licenseSection";
import { PasswordSection } from "./passwordSection";
import { SettingsSection } from "./settingsSection";
import { ShopSection } from "./shopSection";

const SECTIONS = [
  {
    icon: <IconBuildingStore />,
    title: "المحل",
    description: "الاسم الذي يظهر على الإيصالات ورسائل واتساب.",
    content: <ShopSection />,
  },
  {
    icon: <IconCoins />,
    title: "العملة",
    description: "تظهر مع كل الأسعار والفواتير والتقارير، لكل المستخدمين.",
    content: <CurrencySection />,
  },
  {
    icon: <IconPalette />,
    title: "المظهر",
    description: "فاتح أو داكن أو حسب إعداد الجهاز.",
    content: <AppearanceSection />,
  },
  {
    icon: <IconShieldLock />,
    title: "كلمة المرور",
    description: "غيّرها دورياً ولا تشاركها مع الكاشير.",
    content: <PasswordSection />,
  },
  {
    icon: <IconDatabaseExport />,
    title: "النسخ الاحتياطي",
    description: "حماية بياناتك من الأعطال: مكان الحفظ، والاستعادة بضغطة.",
    content: <BackupSection />,
  },
  {
    icon: <IconLicense />,
    title: "الترخيص والاشتراك",
    description: "الترخيص مرتبط بهذا الجهاز.",
    content: <LicenseSection />,
  },
];

/** الإعدادات: المحل، العملة، المظهر، كلمة المرور، النسخ الاحتياطي، والترخيص. */
export function SettingsScreen() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="الإعدادات"
        description="المحل، العملة، المظهر، كلمة المرور، النسخ الاحتياطي، والترخيص."
      />
      {SECTIONS.map((s, index) => (
        <SettingsSection
          key={s.title}
          index={index}
          icon={s.icon}
          title={s.title}
          description={s.description}
        >
          {s.content}
        </SettingsSection>
      ))}
      <DemoDataSection />
    </div>
  );
}
