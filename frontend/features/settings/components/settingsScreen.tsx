"use client";

import {
  IconBuildingStore,
  IconCoins,
  IconDatabaseExport,
  IconDevices,
  IconLicense,
  IconPalette,
  IconShieldLock,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import {
  DevicesSection,
  ThisDeviceSection,
} from "@/features/devices/components/devicesSection";
import { isTerminal, useDeviceConfig } from "@/lib/device";

import { AppearanceSection } from "./appearanceSection";
import { BackupSection } from "./backupSection";
import { CurrencySection } from "./currencySection";
import { DemoDataSection } from "./demoDataSection";
import { LicenseSection } from "./licenseSection";
import { PasswordSection } from "./passwordSection";
import { SettingsSection } from "./settingsSection";
import { ShopSection } from "./shopSection";

interface Section {
  icon: ReactNode;
  title: string;
  description: string;
  content: ReactNode;
}

const SHARED: Section[] = [
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
];

/** على الجهاز الأساسي فقط: ملفاته وشبكته وترخيصه. */
const MAIN_ONLY: Section[] = [
  {
    icon: <IconDevices />,
    title: "أجهزة الكاشير",
    description:
      "أجهزة إضافية في المحل تبيع على نفس البيانات، لكل جهاز درجه ووردياته.",
    content: <DevicesSection />,
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

/** الإعدادات. جهاز الكاشير يرى إعدادات المحل المشتركة فقط + بيانات اتصاله. */
export function SettingsScreen() {
  const device = useDeviceConfig();
  const terminal = isTerminal(device);

  const sections: Section[] = terminal
    ? [
        {
          icon: <IconDevices />,
          title: "هذا الجهاز",
          description: "جهاز كاشير متصل بالجهاز الأساسي في المحل.",
          content: (
            <ThisDeviceSection
              name={device!.device_name}
              mainUrl={device!.main_url}
            />
          ),
        },
        ...SHARED,
      ]
    : [...SHARED, ...MAIN_ONLY];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="الإعدادات"
        description={
          terminal
            ? "إعدادات المحل المشتركة. النسخ الاحتياطي والترخيص من الجهاز الأساسي."
            : "المحل، العملة، المظهر، كلمة المرور، أجهزة الكاشير، النسخ الاحتياطي، والترخيص."
        }
      />
      {sections.map((s, index) => (
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
      {!terminal && <DemoDataSection />}
    </div>
  );
}
