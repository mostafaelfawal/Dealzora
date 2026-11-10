"use client";

import {
  IconBuildingStore,
  IconDatabaseExport,
  IconLicense,
  IconShieldLock,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/shared/PageHeader";

import { BackupSection } from "./backupSection";
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
    icon: <IconShieldLock />,
    title: "كلمة المرور",
    description: "غيّرها دورياً ولا تشاركها مع الكاشير.",
    content: <PasswordSection />,
  },
  {
    icon: <IconDatabaseExport />,
    title: "النسخ الاحتياطي",
    description: "حماية بياناتك من الأعطال وانقطاع الكهرباء.",
    content: <BackupSection />,
  },
  {
    icon: <IconLicense />,
    title: "الترخيص والاشتراك",
    description: "الترخيص مرتبط بهذا الجهاز.",
    content: <LicenseSection />,
  },
];

/** الإعدادات: بيانات المحل، كلمة المرور، النسخ الاحتياطي، والترخيص. */
export function SettingsScreen() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="الإعدادات"
        description="بيانات المحل، كلمة المرور، النسخ الاحتياطي، والترخيص."
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
