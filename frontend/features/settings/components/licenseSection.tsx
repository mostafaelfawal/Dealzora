"use client";

import { IconKey, IconLoader2 } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activateLicense, LicenseError } from "@/features/setup/lib/license";
import { sendLease } from "@/features/devices/api/devices.api";
import { getLicenseLease, waitForLocalBackend } from "@/lib/device";
import { usePlan } from "@/lib/plan";
import { formatDate } from "@/lib/dates";
import { formatDaysArabic } from "@/lib/format";

import { useLicense } from "../hooks/useSettings";
import { isLicenseActive, licenseKindLabel } from "../lib/settingsFormat";
import { PlansSection } from "./plansSection";

/**
 * الخطط والترخيص في قسم واحد، بترتيب ما يفعله العميل:
 * حالته الآن ← يقارن الخطط ويشترك (واتساب) ← يلصق المفتاح الذي يصله.
 */
export function LicenseSection() {
  return (
    <div className="space-y-4">
      <LicenseStatus />
      <div className="border-t pt-4">
        <PlansSection />
      </div>
      <div className="space-y-2 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          وصلك مفتاح الترخيص؟ الصقه هنا لتفعيل خطتك فوراً (أو لتجديدها وتغييرها).
        </p>
        <ActivateForm />
      </div>
    </div>
  );
}

function LicenseStatus() {
  const license = useLicense();
  const plan = usePlan().data;
  const l = license.data;

  if (license.isPending) {
    return <p className="text-xs text-muted-foreground">جارٍ التحقق…</p>;
  }
  if (!l) {
    return (
      <p className="text-xs text-muted-foreground">
        بيانات الترخيص متاحة في نسخة سطح المكتب فقط.
      </p>
    );
  }

  return (
    <dl className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="flex items-center gap-2">
        <dt className="text-muted-foreground">الحالة</dt>
        <dd>
          <Badge
            variant="outline"
            className={
              isLicenseActive(l)
                ? "border-success/50 text-success"
                : "border-destructive/50 text-destructive"
            }
          >
            {l.state === "licensed" && plan && !plan.isFree
              ? `خطة «${plan.name}» مفعّلة`
              : licenseKindLabel(l)}
          </Badge>
        </dd>
      </div>
      {l.days_left !== null && (
        <div className="flex gap-2">
          <dt className="text-muted-foreground">المتبقي</dt>
          <dd className="font-medium">
            {l.days_left <= 0
              ? "منتهي"
              : l.days_left === 1
                ? "يوم واحد"
                : formatDaysArabic(l.days_left)}
          </dd>
        </div>
      )}
      {l.expires_at && l.kind === "licensed" && (
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
    </dl>
  );
}

function ActivateForm() {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [pending, setPending] = useState(false);

  async function activate(event: FormEvent) {
    event.preventDefault();
    if (!key.trim() || pending) return;
    setPending(true);
    try {
      await activateLicense(key.trim());
      // Rust يعيد تشغيل الخادم بالخطة الجديدة: ننتظره، ثم نرسل عقد الترخيص فوراً
      // (يحمل الخطة الجديدة، فتنفتح الميزات حتى لو الخادم لم يُعد تشغيله كما في التطوير).
      await waitForLocalBackend();
      await sendLease(await getLicenseLease()).catch(() => undefined);
      await qc.invalidateQueries();
      setKey("");
      toast.success("تم تفعيل الترخيص", {
        description: "كل ميزات خطتك متاحة الآن.",
      });
    } catch (e) {
      toast.error(e instanceof LicenseError ? e.message : "تعذّر التفعيل");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={activate} className="flex flex-wrap gap-2">
      <Input
        dir="ltr"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="الصق مفتاح الترخيص هنا"
        aria-label="مفتاح الترخيص"
        autoComplete="off"
        spellCheck={false}
        className="h-10 min-w-56 flex-1 font-mono text-xs"
      />
      <Button
        type="submit"
        size="lg"
        disabled={!key.trim() || pending}
        className="h-10 gap-2"
      >
        {pending ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconKey className="size-4" />
        )}
        تفعيل
      </Button>
    </form>
  );
}
