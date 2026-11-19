"use client";

import {
  IconBuildingStore,
  IconCash,
  IconLink,
  IconPlugConnectedX,
  IconShieldLock,
  IconShoppingCart,
  IconWorldWww,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranchStatus } from "@/features/branchTransfers/hooks/useBranchTransfers";
import { useSessionUser } from "@/hooks/useShellData";
import { extractErrorMessage } from "@/lib/errors";

import { useStoreState, useStoreSummary } from "../hooks/useOnlineStore";
import type { StoreState } from "../types/store";
import { StoreAppearance } from "./storeAppearance";
import { StoreLinkBar } from "./storeLinkBar";
import { StoreOrders } from "./storeOrders";
import { StoreOverview, type StoreTab } from "./storeOverview";
import { StoreProducts } from "./storeProducts";
import { StoreSettingsForm } from "./storeSettingsForm";

const TABS: StoreTab[] = [
  "overview",
  "orders",
  "products",
  "appearance",
  "settings",
];

function Notice({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 border bg-card p-8 text-center">
      <span className="flex size-12 items-center justify-center bg-muted text-muted-foreground [&_svg]:size-6">
        {icon}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

function Intro() {
  const points = [
    {
      icon: <IconLink />,
      title: "رابط خاص بمحلك",
      text: "شاركه على واتساب وفيسبوك، والعميل يطلب من موبايله بدون تطبيق.",
    },
    {
      icon: <IconShoppingCart />,
      title: "أنت تختار المعروض",
      text: "من أصنافك نفسها، والأسعار تتحدّث تلقائياً مع البرنامج.",
    },
    {
      icon: <IconCash />,
      title: "الدفع عند الاستلام",
      text: "الطلب يصلك هنا فوراً، تؤكده وتوصّله وتحصّل نقداً.",
    },
  ];
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-2 sm:grid-cols-3">
      {points.map((p) => (
        <div key={p.title} className="space-y-1.5 border bg-card p-4">
          <span className="flex size-9 items-center justify-center bg-primary/10 text-primary [&_svg]:size-5">
            {p.icon}
          </span>
          <p className="text-sm font-semibold">{p.title}</p>
          <p className="text-xs text-muted-foreground">{p.text}</p>
        </div>
      ))}
    </div>
  );
}

function StoreDashboard({ state }: { state: StoreState }) {
  const store = state.store!;
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab") as StoreTab | null;
  const [tab, setTabState] = useState<StoreTab>(
    raw && TABS.includes(raw) ? raw : "overview",
  );
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const counts = useStoreSummary().data?.counts;

  const setTab = (t: StoreTab) => {
    setTabState(t);
    router.replace(`/admin/store?tab=${t}`, { scroll: false });
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title={store.name}
        description="متجرك الإلكتروني: الطلبات بالدفع عند الاستلام، والأصناف المعروضة، وإعدادات التوصيل."
      />
      <StoreLinkBar store={store} />
      <SegmentedTabs
        label="أقسام المتجر"
        items={[
          { id: "overview", label: "نظرة عامة" },
          {
            id: "orders",
            label: "الطلبات",
            count: counts ? counts.new : undefined,
          },
          { id: "products", label: "الأصناف" },
          { id: "appearance", label: "المظهر" },
          { id: "settings", label: "الإعدادات" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "overview" && (
        <StoreOverview
          store={store}
          onGo={setTab}
          onOpenOrder={(id) => {
            setOpenOrder(id);
            setTab("orders");
          }}
        />
      )}
      {tab === "orders" && (
        <StoreOrders
          storeName={store.name}
          openId={openOrder}
          onOpenChange={setOpenOrder}
        />
      )}
      {tab === "products" && <StoreProducts imageBase={state.imageBase} />}
      {tab === "appearance" && (
        <StoreAppearance
          key={store.updatedAt}
          store={store}
          imageBase={state.imageBase}
        />
      )}
      {tab === "settings" && (
        <StoreSettingsForm key={store.updatedAt} state={state} mode="edit" />
      )}
    </div>
  );
}

/** المتجر الإلكتروني («سلسلة»): من الجهاز الرئيسي للمالك فقط، وبياناته على سيرفر الفروع. */
export function StoreScreen() {
  const owner = useSessionUser().role === "owner";
  const status = useBranchStatus();
  const connected = status.data?.connected === true;
  const isAdmin = status.data?.isAdmin === true;
  const state = useStoreState(owner && connected && isAdmin);

  if (!owner)
    return (
      <Notice icon={<IconShieldLock />} title="لمالك المحل فقط">
        المتجر الإلكتروني وطلباته يديرها مالك المحل من حسابه.
      </Notice>
    );

  if (status.isPending || (connected && isAdmin && state.isPending))
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );

  if (!connected)
    return (
      <Notice
        icon={<IconPlugConnectedX />}
        title="اربط المحل بسيرفر الفروع أولاً"
        action={
          <Button
            nativeButton={false}
            render={<Link href="/admin/settings#branches" />}
          >
            الإعدادات ← الفروع
          </Button>
        }
      >
        المتجر يعمل على الإنترنت حتى وجهازك مغلق، لذلك يحتاج تسجيل المحل على
        سيرفر الفروع بمفتاح ترخيص «سلسلة».
      </Notice>
    );

  if (!isAdmin)
    return (
      <Notice icon={<IconShieldLock />} title="من الجهاز الرئيسي للمالك فقط">
        إدارة المتجر الإلكتروني وطلباته من جهاز المالك الرئيسي، مثل إدارة
        الفروع.
      </Notice>
    );

  if (state.isError || !state.data)
    return (
      <Notice
        icon={<IconWorldWww />}
        title="تعذّر تحميل المتجر"
        action={
          <Button variant="outline" onClick={() => void state.refetch()}>
            إعادة المحاولة
          </Button>
        }
      >
        {extractErrorMessage(state.error, "تأكد من الاتصال بالإنترنت")}
      </Notice>
    );

  if (!state.data.store)
    return (
      <div className="flex flex-col gap-4">
        <div className="mx-auto w-full max-w-3xl">
          <PageHeader
            title="أنشئ متجرك الإلكتروني"
            description="دقيقتان فقط: الاسم والرابط ورقم الهاتف، ثم اختر الأصناف المعروضة."
          />
        </div>
        <Intro />
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 text-sm font-semibold">
          <IconBuildingStore className="size-4" />
          بيانات المتجر
        </div>
        <StoreSettingsForm state={state.data} mode="create" />
      </div>
    );

  return <StoreDashboard state={state.data} />;
}
