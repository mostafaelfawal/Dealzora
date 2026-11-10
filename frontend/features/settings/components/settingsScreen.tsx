"use client";

import {
  IconBuildingStore,
  IconDatabaseExport,
  IconDeviceFloppy,
  IconKey,
  IconLicense,
  IconLoader2,
  IconShieldLock,
} from "@tabler/icons-react";
import { useState, type ReactNode } from "react";

import {
  listItem,
  MotionLi,
  MotionDiv,
  fadeUp,
} from "@/components/shared/motion";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNow } from "@/hooks/useNow";
import { formatDate, formatWhen } from "@/lib/dates";
import { formatDaysArabic, formatMinutesAgo } from "@/lib/format";

import { DemoDataSection } from "./demoDataSection";
import {
  useBackups,
  useBackupStatus,
  useChangePassword,
  useCreateBackup,
  useLicense,
  useRenameShop,
  useShopName,
} from "../hooks/useSettings";

function Section({
  icon,
  title,
  description,
  children,
  index,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
  index: number;
}) {
  return (
    <MotionDiv
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay: index * 0.05 }}
      className="space-y-3 border bg-card p-4"
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center bg-muted text-muted-foreground [&_svg]:size-4"
        >
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </MotionDiv>
  );
}

const formatSize = (bytes: number) =>
  bytes > 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function ShopSection() {
  const shop = useShopName();
  const rename = useRenameShop();
  const [name, setName] = useState<string | null>(null);
  const value = name ?? shop.data ?? "";
  const valid = value.trim().length >= 2;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid)
          rename.mutate(value.trim(), { onSuccess: () => setName(null) });
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor="shop-name">اسم المحل (يظهر على الفاتورة)</Label>
        <Input
          id="shop-name"
          value={value}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          className="h-10"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={!valid || name === null || rename.isPending}
        className="h-10 gap-2"
      >
        {rename.isPending ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconDeviceFloppy className="size-4" />
        )}
        حفظ
      </Button>
    </form>
  );
}

function PasswordSection() {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm !== "" && confirm !== next;
  const short = next !== "" && next.length < 10;
  const valid = current && next.length >= 10 && next === confirm;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        change.mutate(
          { current, next },
          {
            onSuccess: () => {
              setCurrent("");
              setNext("");
              setConfirm("");
            },
          },
        );
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="pw-current">كلمة المرور الحالية</Label>
        <Input
          id="pw-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-next">الجديدة (10 أحرف على الأقل)</Label>
        <Input
          id="pw-next"
          type="password"
          autoComplete="new-password"
          value={next}
          aria-invalid={short}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pw-confirm">تأكيد الجديدة</Label>
        <Input
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          aria-invalid={mismatch}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {mismatch && <p className="text-xs text-destructive">غير متطابقة</p>}
      </div>
      <div className="sm:col-span-3">
        <Button
          type="submit"
          size="lg"
          disabled={!valid || change.isPending}
          className="gap-2"
        >
          {change.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconKey className="size-4" />
          )}
          تغيير كلمة المرور
        </Button>
      </div>
    </form>
  );
}

function BackupSection() {
  const status = useBackupStatus();
  const backups = useBackups();
  const create = useCreateBackup();
  const now = useNow(30_000);
  const s = status.data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 text-xs">
          <p>
            آخر نسخة:{" "}
            <span className="font-medium">
              {s?.lastBackupAt && now
                ? formatMinutesAgo(s.lastBackupAt, now)
                : "لا توجد بعد"}
            </span>
          </p>
          <p className="text-muted-foreground">
            نسخة تلقائية كل {s?.autoEveryHours ?? 24} ساعة عند تشغيل البرنامج،
            ونحتفظ بآخر {s?.keep ?? 14} نسخة. كل نسخة مشفّرة بنفس مفتاح قاعدة
            البيانات.
          </p>
          {s && s.pendingSync > 0 && (
            <p className="text-muted-foreground">
              {s.pendingSync} تغيير بانتظار الرفع للسحابة عند ربط الحساب.
            </p>
          )}
        </div>
        <Button
          size="lg"
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="gap-2"
        >
          {create.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDatabaseExport className="size-4" />
          )}
          نسخة احتياطية الآن
        </Button>
      </div>
      {(backups.data?.length ?? 0) > 0 && (
        <ul className="divide-y border text-xs">
          {backups.data!.slice(0, 6).map((b, i) => (
            <MotionLi
              key={b.name}
              {...listItem(i)}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span dir="ltr" className="truncate font-mono">
                {b.name}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatWhen(b.createdAt)} · {formatSize(b.size)}
              </span>
            </MotionLi>
          ))}
        </ul>
      )}
    </div>
  );
}

function LicenseSection() {
  const license = useLicense();
  const l = license.data;
  if (license.isPending)
    return <p className="text-xs text-muted-foreground">جارٍ التحقق…</p>;
  if (!l)
    return (
      <p className="text-xs text-muted-foreground">
        بيانات الترخيص متاحة في نسخة سطح المكتب فقط.
      </p>
    );
  const active = l.state === "trial" || l.state === "licensed";
  return (
    <dl className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="flex items-center gap-2">
        <dt className="text-muted-foreground">الحالة</dt>
        <dd>
          <Badge
            variant="outline"
            className={
              active
                ? "border-success/50 text-success"
                : "border-destructive/50 text-destructive"
            }
          >
            {l.kind === "trial"
              ? "تجربة مجانية"
              : l.kind === "licensed"
                ? "اشتراك مفعّل"
                : "غير مفعّل"}
          </Badge>
        </dd>
      </div>
      {l.days_left !== null && (
        <div className="flex gap-2">
          <dt className="text-muted-foreground">المتبقي</dt>
          <dd className="font-medium">
            {l.days_left > 0 ? formatDaysArabic(l.days_left) : "منتهي"}
          </dd>
        </div>
      )}
      {l.expires_at && (
        <div className="flex gap-2">
          <dt className="text-muted-foreground">ينتهي في</dt>
          <dd>{formatDate(l.expires_at * 1000)}</dd>
        </div>
      )}
      <div className="flex min-w-0 gap-2 sm:col-span-2">
        <dt className="shrink-0 text-muted-foreground">رقم الجهاز</dt>
        <dd dir="ltr" className="truncate font-mono select-all">
          {l.machine_id}
        </dd>
      </div>
      <p className="text-muted-foreground sm:col-span-2">
        للتجديد أرسل رقم الجهاز لفريق Dealzora لتحصل على مفتاح التفعيل.
      </p>
    </dl>
  );
}

export function SettingsScreen() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="الإعدادات"
        description="بيانات المحل، كلمة المرور، النسخ الاحتياطي، والترخيص."
      />
      <Section
        index={0}
        icon={<IconBuildingStore />}
        title="المحل"
        description="الاسم الذي يظهر على الإيصالات ورسائل واتساب."
      >
        <ShopSection />
      </Section>
      <Section
        index={1}
        icon={<IconShieldLock />}
        title="كلمة المرور"
        description="غيّرها دورياً ولا تشاركها مع الكاشير."
      >
        <PasswordSection />
      </Section>
      <Section
        index={2}
        icon={<IconDatabaseExport />}
        title="النسخ الاحتياطي"
        description="حماية بياناتك من الأعطال وانقطاع الكهرباء."
      >
        <BackupSection />
      </Section>
      <Section
        index={3}
        icon={<IconLicense />}
        title="الترخيص والاشتراك"
        description="الترخيص مرتبط بهذا الجهاز."
      >
        <LicenseSection />
      </Section>
      <DemoDataSection />
    </div>
  );
}
