"use client";

import {
  IconArrowsExchange,
  IconBuildingStore,
  IconCashRegister,
  IconCoins,
  IconCrown,
  IconDatabaseExport,
  IconDevices,
  IconGift,
  IconPalette,
  IconPercentage,
  IconScale,
  IconShieldCheck,
  IconShieldLock,
  IconUserCircle,
  IconWallet,
} from "@tabler/icons-react";
import { useEffect, type KeyboardEvent, type ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { BranchConnectSection } from "@/features/branchTransfers/components/branchConnectSection";
import {
  DevicesSection,
  ThisDeviceSection,
} from "@/features/devices/components/devicesSection";
import { isTerminal, useDeviceConfig, type DeviceConfig } from "@/lib/device";
import { cn } from "@/lib/utils";

import { useSettingsTab } from "../hooks/useSettingsTab";
import { AppearanceSection } from "./appearanceSection";
import { BackupSection } from "./backupSection";
import { CurrencySection } from "./currencySection";
import { DemoDataSection } from "./demoDataSection";
import { DiscountLimitSection } from "./discountLimitSection";
import { LicenseSection } from "./licenseSection";
import { LoyaltySection } from "./loyaltySection";
import { PasswordSection } from "./passwordSection";
import { PaymentsSection } from "./paymentsSection";
import { ScaleBarcodeSection } from "./scaleBarcodeSection";
import { SettingsSection } from "./settingsSection";
import { ShopSection } from "./shopSection";

/**
 * الإعدادات لتاجر عادي: 5 صفحات بأسماء من يومه بدل قائمة طويلة من الأقسام.
 * كل صفحة تعرض إعداداتها كبطاقات تحت بعض، فلا يبحث عن «أين كان الإعداد؟».
 * الروابط القديمة لقسم بعينه (#plans، #scale…) تفتح صفحته وتنزل للبطاقة.
 */

interface Section {
  /** مرساة في الرابط: /admin/settings#scale */
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  content: ReactNode;
}

interface Page {
  id: string;
  icon: ReactNode;
  title: string;
  /** سؤال/جملة قصيرة يفهمها التاجر: ماذا يجد هنا؟ */
  hint: string;
  sections: Section[];
}

function buildPages(device: DeviceConfig | null): Page[] {
  const terminal = isTerminal(device);

  const shop: Page = {
    id: "shop",
    icon: <IconBuildingStore />,
    title: "محلي",
    hint: "اسم المحل والعملة",
    sections: [
      {
        id: "shop-info",
        icon: <IconBuildingStore />,
        title: "اسم المحل",
        description: "يظهر أعلى الإيصال وفي رسائل واتساب للعملاء.",
        content: <ShopSection />,
      },
      {
        id: "currency",
        icon: <IconCoins />,
        title: "العملة",
        description: "تظهر مع كل الأسعار والفواتير والتقارير.",
        content: <CurrencySection />,
      },
    ],
  };

  const selling: Page = {
    id: "selling",
    icon: <IconCashRegister />,
    title: "البيع والكاشير",
    hint: "الدفع، الخصم، النقاط، الميزان",
    sections: [
      {
        id: "payments",
        icon: <IconWallet />,
        title: "طرق الدفع",
        description:
          "المحافظ والبطاقات والتحويلات اللي بتقبلها، مع رقم الحساب اللي يظهر للكاشير.",
        content: <PaymentsSection />,
      },
      {
        id: "discount",
        icon: <IconPercentage />,
        title: "أقصى خصم للكاشير",
        description:
          "الكاشير ما يقدرش يخصم أكتر من النسبة دي من الفاتورة. المدير بلا حد.",
        content: <DiscountLimitSection />,
      },
      {
        id: "loyalty",
        icon: <IconGift />,
        title: "نقاط الولاء",
        description:
          "العميل المسجّل يكسب نقاط على كل شراء ويستبدلها خصماً، فيرجع يشتري منك تاني.",
        content: <LoyaltySection />,
      },
      {
        id: "scale",
        icon: <IconScale />,
        title: "ميزان الأصناف الموزونة",
        description:
          "لو عندك ميزان بيطبع ملصق باركود: الكاشير يمسحه فيتضاف الصنف بوزنه.",
        content: <ScaleBarcodeSection />,
      },
    ],
  };

  const safety: Page = terminal
    ? {
        id: "device",
        icon: <IconDevices />,
        title: "هذا الجهاز",
        hint: "الاتصال بالجهاز الأساسي",
        sections: [
          {
            id: "this-device",
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
        ],
      }
    : {
        id: "safety",
        icon: <IconShieldCheck />,
        title: "الأجهزة والحماية",
        hint: "نسخ احتياطي وأجهزة كاشير وفروع",
        sections: [
          {
            id: "backup",
            icon: <IconDatabaseExport />,
            title: "النسخ الاحتياطي",
            description:
              "بياناتك بتتحفظ تلقائياً. اختار مكان الحفظ (فلاشة مثلاً) أو رجّع نسخة قديمة.",
            content: <BackupSection />,
          },
          {
            id: "devices",
            icon: <IconDevices />,
            title: "أجهزة الكاشير",
            description:
              "أجهزة تانية في المحل تبيع على نفس البيانات، ولكل جهاز درجه ووردياته.",
            content: <DevicesSection />,
          },
          {
            id: "branches",
            icon: <IconArrowsExchange />,
            title: "الفروع",
            description:
              "اربط الجهاز ده بسيرفر الفروع عشان تبعت وتستلم بضاعة من فروعك التانية.",
            content: <BranchConnectSection />,
          },
        ],
      };

  const account: Page = {
    id: "account",
    icon: <IconUserCircle />,
    title: "حسابي",
    hint: "كلمة المرور والشكل",
    sections: [
      {
        id: "password",
        icon: <IconShieldLock />,
        title: "كلمة المرور",
        description: "غيّرها كل فترة، وما تديهاش للكاشير.",
        content: <PasswordSection />,
      },
      {
        id: "appearance",
        icon: <IconPalette />,
        title: "شكل البرنامج",
        description:
          "فاتح أو غامق، وتشغيل الحركة أو إيقافها على الأجهزة الضعيفة.",
        content: <AppearanceSection />,
      },
    ],
  };

  const plan: Page = {
    id: "subscription",
    icon: <IconCrown />,
    title: "اشتراكي",
    hint: "خطتك والتفعيل",
    sections: [
      {
        id: "plans",
        icon: <IconCrown />,
        title: "الخطة والترخيص",
        description:
          "خطتك الحالية، الترقية، وتفعيل المفتاح. الترخيص مرتبط بهذا الجهاز.",
        content: <LicenseSection />,
      },
    ],
  };

  // الاشتراك والترخيص من الجهاز الأساسي فقط.
  return terminal
    ? [shop, selling, account, safety]
    : [shop, selling, safety, account, plan];
}

const tabId = (id: string) => `settings-tab-${id}`;

export function SettingsScreen() {
  const device = useDeviceConfig();
  const terminal = isTerminal(device);
  const pages = buildPages(device);

  // الرابط قد يكون صفحة (#selling) أو قسماً داخلها (#scale).
  const sectionPage = new Map(
    pages.flatMap((p) => p.sections.map((s) => [s.id, p.id] as const)),
  );
  const anchors = [...pages.map((p) => p.id), ...sectionPage.keys()];
  const { active, setActive } = useSettingsTab(anchors);
  const pageId = sectionPage.get(active) ?? active;
  const page = pages.find((p) => p.id === pageId) ?? pages[0];

  // رابط لقسم بعينه: ننزل لبطاقته بعد ظهور الصفحة.
  useEffect(() => {
    if (!sectionPage.has(active)) return;
    const t = setTimeout(
      () =>
        document
          .getElementById(active)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sectionPage مشتق من pages
  }, [active]);

  function onNavKey(event: KeyboardEvent<HTMLDivElement>) {
    const ids = pages.map((p) => p.id);
    const step =
      event.key === "ArrowLeft" ? 1 : event.key === "ArrowRight" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = ids[(ids.indexOf(page.id) + step + ids.length) % ids.length];
    setActive(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="الإعدادات"
        description={
          terminal
            ? "إعدادات المحل المشتركة. النسخ الاحتياطي والاشتراك من الجهاز الأساسي."
            : "اختار اللي عايز تظبطه:"
        }
      />

      <div
        role="tablist"
        aria-label="صفحات الإعدادات"
        onKeyDown={onNavKey}
        className={cn(
          "no-scrollbar grid auto-cols-[minmax(9.5rem,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1",
          "md:grid-flow-row md:auto-cols-auto",
          pages.length === 5 ? "md:grid-cols-5" : "md:grid-cols-4",
        )}
      >
        {pages.map((p) => {
          const selected = p.id === page.id;
          return (
            <button
              key={p.id}
              id={tabId(p.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-page-${p.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(p.id)}
              className={cn(
                "flex items-center gap-3 border p-3 text-start outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-primary/40",
                selected
                  ? "border-primary bg-primary/5"
                  : "bg-card hover:border-primary/40 hover:bg-muted/50",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center [&_svg]:size-5",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {p.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold whitespace-nowrap">
                  {p.title}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {p.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={`settings-page-${page.id}`}
        role="tabpanel"
        aria-labelledby={tabId(page.id)}
        className="flex min-w-0 flex-col gap-4"
      >
        {page.sections.map((s) => (
          // key: يعيد الحركة ويصفّر حالة القسم عند تغيير الصفحة.
          <SettingsSection
            key={`${page.id}-${s.id}`}
            id={s.id}
            icon={s.icon}
            title={s.title}
            description={s.description}
          >
            {s.content}
          </SettingsSection>
        ))}
        {!terminal && <DemoDataSection />}
      </div>
    </div>
  );
}
