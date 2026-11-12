"use client";

import {
  IconBuildingStore,
  IconCoins,
  IconCrown,
  IconDatabaseExport,
  IconDevices,
  IconPalette,
  IconShieldLock,
  IconWallet,
} from "@tabler/icons-react";
import type { KeyboardEvent, ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import {
  DevicesSection,
  ThisDeviceSection,
} from "@/features/devices/components/devicesSection";
import { isTerminal, useDeviceConfig } from "@/lib/device";
import { cn } from "@/lib/utils";

import { useSettingsTab } from "../hooks/useSettingsTab";
import { AppearanceSection } from "./appearanceSection";
import { BackupSection } from "./backupSection";
import { CurrencySection } from "./currencySection";
import { DemoDataSection } from "./demoDataSection";
import { LicenseSection } from "./licenseSection";
import { PasswordSection } from "./passwordSection";
import { PaymentsSection } from "./paymentsSection";
import { SettingsSection } from "./settingsSection";
import { ShopSection } from "./shopSection";

type GroupId = "shop" | "account" | "system";

const GROUPS: { id: GroupId; label: string }[] = [
  { id: "shop", label: "المحل" },
  { id: "account", label: "حسابي" },
  { id: "system", label: "النظام" },
];

interface Section {
  /** يظهر في الرابط: /admin/settings#plans */
  id: string;
  group: GroupId;
  icon: ReactNode;
  title: string;
  /** سطر قصير في القائمة الجانبية. */
  hint: string;
  description: string;
  content: ReactNode;
}

const SHARED: Section[] = [
  {
    id: "shop",
    group: "shop",
    icon: <IconBuildingStore />,
    title: "بيانات المحل",
    hint: "الاسم على الإيصالات",
    description: "الاسم الذي يظهر على الإيصالات ورسائل واتساب.",
    content: <ShopSection />,
  },
  {
    id: "currency",
    group: "shop",
    icon: <IconCoins />,
    title: "العملة",
    hint: "مع كل الأسعار والتقارير",
    description: "تظهر مع كل الأسعار والفواتير والتقارير، لكل المستخدمين.",
    content: <CurrencySection />,
  },
  {
    id: "payments",
    group: "shop",
    icon: <IconWallet />,
    title: "طرق الدفع",
    hint: "فودافون كاش وإنستاباي",
    description:
      "فودافون كاش وإنستاباي: رقم المحل الذي يحوّل عليه العميل ويظهر للكاشير.",
    content: <PaymentsSection />,
  },
  {
    id: "appearance",
    group: "account",
    icon: <IconPalette />,
    title: "المظهر",
    hint: "فاتح أو داكن",
    description: "فاتح أو داكن أو حسب إعداد الجهاز.",
    content: <AppearanceSection />,
  },
  {
    id: "password",
    group: "account",
    icon: <IconShieldLock />,
    title: "كلمة المرور",
    hint: "تغيير كلمة مرورك",
    description: "غيّرها دورياً ولا تشاركها مع الكاشير.",
    content: <PasswordSection />,
  },
];

/** على الجهاز الأساسي فقط: ملفاته وشبكته وترخيصه. */
const MAIN_ONLY: Section[] = [
  {
    id: "devices",
    group: "system",
    icon: <IconDevices />,
    title: "أجهزة الكاشير",
    hint: "أجهزة إضافية في المحل",
    description:
      "أجهزة إضافية في المحل تبيع على نفس البيانات، لكل جهاز درجه ووردياته.",
    content: <DevicesSection />,
  },
  {
    id: "backup",
    group: "system",
    icon: <IconDatabaseExport />,
    title: "النسخ الاحتياطي",
    hint: "الحفظ والاستعادة",
    description: "حماية بياناتك من الأعطال: مكان الحفظ، والاستعادة بضغطة.",
    content: <BackupSection />,
  },
  {
    // #plans: أزرار «عرض الخطط» في الميزات المقفولة تفتح هذا القسم مباشرة.
    id: "plans",
    group: "system",
    icon: <IconCrown />,
    title: "الخطط والترخيص",
    hint: "خطتك والترقية والتفعيل",
    description:
      "خطتك الحالية، الترقية، وتفعيل المفتاح. الترخيص مرتبط بهذا الجهاز.",
    content: <LicenseSection />,
  },
];

const tabId = (id: string) => `settings-tab-${id}`;

/** الإعدادات: قائمة أقسام مجمّعة على الجانب (شريط أفقي على الموبايل) + القسم المفتوح. */
export function SettingsScreen() {
  const device = useDeviceConfig();
  const terminal = isTerminal(device);

  const sections: Section[] = terminal
    ? [
        ...SHARED,
        {
          id: "device",
          group: "system",
          icon: <IconDevices />,
          title: "هذا الجهاز",
          hint: "الاتصال بالجهاز الأساسي",
          description: "جهاز كاشير متصل بالجهاز الأساسي في المحل.",
          content: (
            <ThisDeviceSection
              name={device!.device_name}
              mainUrl={device!.main_url}
            />
          ),
        },
      ]
    : [...SHARED, ...MAIN_ONLY];

  const ids = sections.map((s) => s.id);
  const { active, setActive } = useSettingsTab(ids);
  const current = sections.find((s) => s.id === active) ?? sections[0];

  // الأسهم تتنقل بين الأقسام (لأعلى/لأسفل على الشاشة الكبيرة، يمين/يسار على الموبايل).
  function onNavKey(event: KeyboardEvent<HTMLDivElement>) {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowLeft"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowRight"
          ? -1
          : 0;
    const edge =
      event.key === "Home" ? 0 : event.key === "End" ? ids.length - 1 : null;
    if (!step && edge === null) return;
    event.preventDefault();
    const index = ids.indexOf(current.id);
    const next =
      ids[edge ?? (index + step + ids.length) % ids.length];
    setActive(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="الإعدادات"
        description={
          terminal
            ? "إعدادات المحل المشتركة. النسخ الاحتياطي والترخيص من الجهاز الأساسي."
            : "كل إعدادات المحل والنظام في مكان واحد. اختر قسماً من القائمة."
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-6">
        <nav
          aria-label="أقسام الإعدادات"
          className="min-w-0 lg:sticky lg:top-4"
        >
          <div
            role="tablist"
            aria-orientation="vertical"
            onKeyDown={onNavKey}
            className="no-scrollbar flex gap-1.5 overflow-x-auto lg:flex-col lg:gap-4 lg:overflow-visible"
          >
            {GROUPS.map((group) => {
              const items = sections.filter((s) => s.group === group.id);
              if (items.length === 0) return null;
              return (
                <div
                  key={group.id}
                  role="presentation"
                  className="flex shrink-0 gap-1.5 lg:flex-col lg:gap-0.5"
                >
                  <p
                    role="presentation"
                    className="hidden px-3 pb-1 text-[11px] font-medium text-muted-foreground lg:block"
                  >
                    {group.label}
                  </p>
                  {items.map((s) => {
                    const selected = s.id === current.id;
                    return (
                      <button
                        key={s.id}
                        id={tabId(s.id)}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={s.id}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => setActive(s.id)}
                        className={cn(
                          "group flex shrink-0 items-center gap-2.5 border px-3 py-2 text-start text-xs outline-none transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-primary/40",
                          "lg:border-0 lg:border-s-2 lg:py-2.5",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "bg-card text-foreground hover:bg-muted lg:border-s-transparent lg:bg-transparent",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex shrink-0 [&_svg]:size-4",
                            !selected && "text-muted-foreground",
                          )}
                        >
                          {s.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium whitespace-nowrap">
                            {s.title}
                          </span>
                          <span className="hidden truncate text-[11px] font-normal text-muted-foreground lg:block">
                            {s.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          {/* key: يعيد الحركة ويصفّر حالة القسم عند التبديل. */}
          <SettingsSection
            key={current.id}
            id={current.id}
            icon={current.icon}
            title={current.title}
            description={current.description}
          >
            {current.content}
          </SettingsSection>
          {!terminal && <DemoDataSection />}
        </div>
      </div>
    </div>
  );
}
