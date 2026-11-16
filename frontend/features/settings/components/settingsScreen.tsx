"use client";

import {
  IconArrowsExchange,
  IconBuildingStore,
  IconCashRegister,
  IconCoins,
  IconCrown,
  IconDatabaseExport,
  IconDevices,
  IconFileCertificate,
  IconGift,
  IconMapPin,
  IconRuler,
  IconPalette,
  IconPercentage,
  IconPrinter,
  IconReceiptTax,
  IconRefresh,
  IconSearch,
  IconTemplate,
  IconX,
  IconScale,
  IconSend,
  IconShieldCheck,
  IconShieldLock,
  IconUserCircle,
  IconWallet,
} from "@tabler/icons-react";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { isOwner } from "@/config/roles";
import { BranchConnectSection } from "@/features/branchTransfers/components/branchConnectSection";
import {
  DevicesSection,
  ThisDeviceSection,
} from "@/features/devices/components/devicesSection";
import { EtaActivation } from "@/features/eta/components/etaActivation";
import { EtaDevices } from "@/features/eta/components/etaDevices";
import { EtaSending } from "@/features/eta/components/etaSending";
import {
  EtaBranchForm,
  EtaShopForm,
} from "@/features/eta/components/etaShopForm";
import { EtaUnits } from "@/features/eta/components/etaUnits";
import { PlanGate, UpgradeNotice } from "@/components/shared/PlanGate";
import { useFeature } from "@/lib/plan";
import { useSessionUser } from "@/hooks/useShellData";
import { isTerminal, useDeviceConfig, type DeviceConfig } from "@/lib/device";
import { cn } from "@/lib/utils";

import { useSettingsTab } from "../hooks/useSettingsTab";
import { AppearanceSection } from "./appearanceSection";
import { BackupSection } from "./backupSection";
import { CurrencySection } from "./currencySection";
import { ExchangeSection } from "./exchangeSection";
import { DemoDataSection } from "./demoDataSection";
import { DiscountLimitSection } from "./discountLimitSection";
import { LicenseSection } from "./licenseSection";
import { LoyaltySection } from "./loyaltySection";
import { PasswordSection } from "./passwordSection";
import { PaymentsSection } from "./paymentsSection";
import { PrinterSection } from "./printerSection";
import { ReceiptDesignSection } from "./receiptDesignSection";
import { ScaleBarcodeSection } from "./scaleBarcodeSection";
import { SettingsSection } from "./settingsSection";
import { ShopSection } from "./shopSection";
import { TaxSection } from "./taxSection";
import { UpdateSection } from "@/features/updates/components/updateSection";
import { AppTooltip } from "@/components/shared/AppTooltip";

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
  /** كلمات إضافية للبحث (ما يكتبه التاجر بلغته). */
  keywords?: string;
}

interface Page {
  id: string;
  icon: ReactNode;
  title: string;
  /** سؤال/جملة قصيرة يفهمها التاجر: ماذا يجد هنا؟ */
  hint: string;
  sections: Section[];
}

/** الإيصال الإلكتروني (منظومة الضرائب): كل الأقسام لخطة «سلسلة»، وإلا رسالة الترقية وحدها. */
function eReceiptPage(allowed: boolean): Page {
  const lockedOrSections: Section[] = allowed
    ? [
        {
          id: "e-receipt",
          icon: <IconFileCertificate />,
          title: "الجاهزية والتفعيل",
          description: "ما ينقص قبل التفعيل. لا يُفعَّل والقائمة فيها بند مطلوب.",
          content: <EtaActivation />,
        },
        {
          id: "eta-sending",
          icon: <IconSend />,
          title: "الإرسال للمنظومة",
          description:
            "حالة الإيصالات، والإرسال الآن، وآخر محاولات الاتصال بالمنظومة.",
          content: <EtaSending />,
        },
        {
          id: "eta-shop",
          icon: <IconBuildingStore />,
          title: "بيانات المحل في المنظومة",
          description: "رقم التسجيل الضريبي والاسم التجاري وكود النشاط.",
          content: <EtaShopForm />,
        },
        {
          id: "eta-branch",
          icon: <IconMapPin />,
          title: "الفرع",
          description: "كود هذا الفرع في المنظومة وعنوانه كما يظهر في الإيصال.",
          content: <EtaBranchForm />,
        },
        {
          id: "eta-devices",
          icon: <IconDevices />,
          title: "الأجهزة",
          description:
            "الرقم التسلسلي وبيانات الدخول لكل جهاز يصدر إيصالات (الأساسي وأجهزة الكاشير).",
          content: <EtaDevices />,
        },
        {
          id: "eta-units",
          icon: <IconRuler />,
          title: "وحدات القياس",
          description: "كود كل وحدة بيع في جدول وحدات المنظومة.",
          content: <EtaUnits />,
        },
      ]
    : [
        {
          id: "e-receipt",
          icon: <IconFileCertificate />,
          title: "الإيصال الإلكتروني",
          description: "الربط مع منظومة الإيصال الإلكتروني لمصلحة الضرائب.",
          content: <UpgradeNotice feature="e_receipt" className="border-0" />,
        },
      ];
  return {
    id: "e-receipt-page",
    icon: <IconFileCertificate />,
    title: "الإيصال الإلكتروني",
    hint: "منظومة مصلحة الضرائب",
    sections: lockedOrSections,
  };
}

function buildPages(
  device: DeviceConfig | null,
  owner: boolean,
  eReceipt: boolean,
): Page[] {
  const terminal = isTerminal(device);

  const shop: Page = {
    id: "shop",
    icon: <IconBuildingStore />,
    title: "محلي",
    hint: "اسم المحل والعملة وسعر الصرف والضريبة",
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
      {
        id: "exchange",
        icon: <IconArrowsExchange />,
        title: "العملة الثانية وسعر الصرف",
        description:
          "اعرض المقابل بعملة ثانية (دولار، ليرة…) في البيع والفاتورة، بسعر صرف من الإنترنت أو تكتبه بنفسك.",
        content: <ExchangeSection />,
        keywords: "دولار ليره صرف تحويل عمله سعر الصرف",
      },
      {
        id: "tax",
        icon: <IconReceiptTax />,
        title: "ضريبة القيمة المضافة",
        description:
          "للمحل المسجل في الضريبة: تُحسب على كل فاتورة وتظهر في الإيصال والتقارير.",
        content: <TaxSection />,
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
          "المحافظ والبطاقات والتحويلات التي تقبلها، مع رقم الحساب الذي يظهر للكاشير.",
        content: <PaymentsSection />,
      },
      {
        id: "discount",
        icon: <IconPercentage />,
        title: "أقصى خصم للكاشير",
        description:
          "لا يستطيع الكاشير خصم أكثر من هذه النسبة من الفاتورة. المدير بلا حد.",
        content: <DiscountLimitSection />,
      },
      {
        id: "loyalty",
        icon: <IconGift />,
        title: "نقاط الولاء",
        description:
          "يكسب العميل المسجّل نقاطاً على كل عملية شراء ويستبدلها خصماً، فيعود للشراء منك مجدداً.",
        content: (
          <PlanGate feature="loyalty" className="border-0">
            <LoyaltySection />
          </PlanGate>
        ),
      },
      {
        id: "scale",
        icon: <IconScale />,
        title: "ميزان الأصناف الموزونة",
        description:
          "إذا كان لديك ميزان يطبع ملصق باركود: يمسحه الكاشير فيُضاف الصنف بوزنه.",
        content: (
          <PlanGate feature="scale_barcode" className="border-0">
            <ScaleBarcodeSection />
          </PlanGate>
        ),
      },
    ],
  };

  const printing: Page = {
    id: "printing",
    icon: <IconPrinter />,
    title: "الطباعة والفاتورة",
    hint: "نوع الطابعة وشكل الفاتورة",
    sections: [
      {
        id: "printer",
        icon: <IconPrinter />,
        title: "الطابعة",
        description:
          "طابعة إيصالات حرارية أم طابعة عادية A4؟ اختر ما عندك على هذا الجهاز.",
        content: <PrinterSection />,
        keywords: "حراريه رول 80 58 درج قص",
      },
      {
        id: "receipt-design",
        icon: <IconTemplate />,
        title: "شكل الفاتورة",
        description:
          "الشعار والعنوان والتليفون ورسالة الشكر، وما يظهر في الفاتورة. يُطبّق على كل الأجهزة.",
        content: <ReceiptDesignSection />,
        keywords: "شعار لوجو عنوان تليفون رقم ضريبي لون خط شروط استبدال ايصال",
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
              "تُحفظ بياناتك تلقائياً. اختر مكان الحفظ (فلاشة مثلاً) أو استرجع نسخة سابقة.",
            content: <BackupSection />,
          },
          {
            id: "devices",
            icon: <IconDevices />,
            title: "أجهزة الكاشير",
            description:
              "أجهزة أخرى في المحل تبيع على البيانات نفسها، ولكل جهاز درجه ووردياته.",
            content: <DevicesSection />,
          },
          {
            id: "branches",
            icon: <IconArrowsExchange />,
            title: "الفروع",
            description:
              "اربط هذا الجهاز بسيرفر الفروع لتتمكن من إرسال البضاعة واستلامها من فروعك الأخرى.",
            content: <BranchConnectSection />,
          },
        ],
      };

  const account: Page = {
    id: "account",
    icon: <IconUserCircle />,
    title: "حسابي",
    hint: "كلمة المرور والشكل والتحديثات",
    sections: [
      {
        id: "password",
        icon: <IconShieldLock />,
        title: "كلمة المرور",
        description: "غيّرها من حين لآخر، ولا تعطها للكاشير.",
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
      {
        id: "updates",
        icon: <IconRefresh />,
        title: "تحديث البرنامج",
        description:
          "نسخ جديدة بتحسينات وإصلاحات. تختار أنت وقت التحديث، وبياناتك تبقى كما هي.",
        content: <UpdateSection />,
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
        content: owner ? (
          <LicenseSection />
        ) : (
          <p className="text-sm text-muted-foreground">
            الاشتراك والتفعيل متاحان لحساب <b>مالك المحل</b> فقط.
          </p>
        ),
      },
    ],
  };

  // الاشتراك والترخيص من الجهاز الأساسي فقط.
  return terminal
    ? [shop, selling, printing, account, safety]
    : [shop, selling, printing, eReceiptPage(eReceipt), safety, account, plan];
}

const tabId = (id: string) => `settings-tab-${id}`;

/** بحث بسيط يتجاهل الهمزات والتاء المربوطة والألف المقصورة والتشكيل (ما يكتبه التاجر بسرعة). */
const normalize = (t: string) =>
  t
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ً-ْ]/g, "");

export function SettingsScreen() {
  const device = useDeviceConfig();
  const terminal = isTerminal(device);
  const owner = isOwner(useSessionUser().role);
  const eReceipt = useFeature("e_receipt");
  const pages = buildPages(device, owner, eReceipt);
  const [query, setQuery] = useState("");

  // الرابط قد يكون صفحة (#selling) أو قسماً داخلها (#scale).
  const sectionPage = new Map(
    pages.flatMap((p) => p.sections.map((s) => [s.id, p.id] as const)),
  );
  const anchors = [...pages.map((p) => p.id), ...sectionPage.keys()];
  const { active, setActive } = useSettingsTab(anchors);
  const pageId = sectionPage.get(active) ?? active;
  const page = pages.find((p) => p.id === pageId) ?? pages[0];

  const q = normalize(query.trim());
  const results = q
    ? pages.flatMap((p) =>
        p.sections
          .filter((s) =>
            normalize(
              `${s.title} ${s.description} ${s.keywords ?? ""} ${p.title}`,
            ).includes(q),
          )
          .map((s) => ({ page: p, section: s })),
      )
    : null;

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

  function open(id: string) {
    setQuery("");
    setActive(id);
  }

  function onNavKey(event: KeyboardEvent<HTMLElement>) {
    const ids = pages.map((p) => p.id);
    // عمودي على الشاشات الكبيرة، أفقي (RTL) على الصغيرة.
    const step =
      event.key === "ArrowDown" || event.key === "ArrowLeft"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowRight"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = ids[(ids.indexOf(page.id) + step + ids.length) % ids.length];
    open(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="الإعدادات"
        description={
          terminal
            ? "إعدادات المحل المشتركة. النسخ الاحتياطي والاشتراك من الجهاز الأساسي."
            : "كل ما يخص محلك في مكان واحد. اختر من القائمة أو ابحث."
        }
        actions={
          <div className="relative w-full sm:w-72">
            <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="ابحث: طابعة، شعار، ضريبة…"
              aria-label="ابحث في الإعدادات"
              className="h-10 ps-9 pe-9"
            />
            {query && (
              <button
                type="button"
                aria-label="مسح البحث"
                onClick={() => setQuery("")}
                className="absolute end-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <IconX className="size-4" />
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <nav
          role="tablist"
          aria-label="صفحات الإعدادات"
          aria-orientation="vertical"
          onKeyDown={onNavKey}
          className={cn(
            "no-scrollbar flex gap-1.5 overflow-x-auto pb-1",
            "lg:sticky lg:top-4 lg:flex-col lg:overflow-visible lg:border lg:bg-card lg:p-2",
          )}
        >
          {pages.map((p) => {
            const selected = !results && p.id === page.id;
            return (
              <button
                key={p.id}
                id={tabId(p.id)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`settings-page-${p.id}`}
                tabIndex={p.id === page.id ? 0 : -1}
                onClick={() => open(p.id)}
                className={cn(
                  "group flex shrink-0 items-center gap-3 border p-2.5 text-start outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-primary/40",
                  selected
                    ? "border-primary bg-primary/5 lg:border-primary/30"
                    : "bg-card hover:bg-muted/60 lg:border-transparent lg:bg-transparent",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center [&_svg]:size-[18px]",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {p.icon}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm whitespace-nowrap",
                      selected ? "font-semibold" : "font-medium",
                    )}
                  >
                    {p.title}
                  </span>
                  <AppTooltip message={p.hint} onlyWhenTruncated>
                    <span className="hidden truncate text-[11px] text-muted-foreground lg:block">
                      {p.hint}
                    </span>
                  </AppTooltip>
                </span>
              </button>
            );
          })}
        </nav>

        {results ? (
          <SearchResults query={query} results={results} onOpen={open} />
        ) : (
          <div
            id={`settings-page-${page.id}`}
            role="tabpanel"
            aria-labelledby={tabId(page.id)}
            className="flex min-w-0 flex-col gap-4"
          >
            <div className="flex items-center gap-3 border-b pb-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center bg-primary text-primary-foreground [&_svg]:size-5"
              >
                {page.icon}
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold">{page.title}</h2>
                <p className="text-xs text-muted-foreground">{page.hint}</p>
              </div>
            </div>
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
            {!terminal && page.id === "safety" && <DemoDataSection />}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchResults({
  query,
  results,
  onOpen,
}: {
  query: string;
  results: { page: Page; section: Section }[];
  onOpen: (id: string) => void;
}) {
  return (
    <section aria-live="polite" className="min-w-0 space-y-3">
      <p className="text-xs text-muted-foreground">
        {results.length
          ? `${results.length} نتيجة لـ «${query.trim()}»`
          : `لا توجد نتائج لـ «${query.trim()}». جرّب كلمة أبسط مثل: طابعة، ضريبة، نسخ.`}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {results.map(({ page, section }) => (
          <li key={`${page.id}-${section.id}`}>
            <button
              type="button"
              onClick={() => onOpen(section.id)}
              className="flex h-full w-full items-start gap-3 border bg-card p-3 text-start outline-none transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center bg-primary/10 text-primary [&_svg]:size-[18px]"
              >
                {section.icon}
              </span>
              <span className="min-w-0 space-y-0.5">
                <span className="block text-sm font-semibold">
                  {section.title}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {page.title}
                </span>
                <span className="line-clamp-2 block text-xs text-muted-foreground">
                  {section.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
