"use client";

import { IconKey, IconLoader2 } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activateLicense, LicenseError } from "@/features/setup/lib/license";
import { waitForLocalBackend } from "@/lib/device";
import { usePlan } from "@/lib/plan";
import { formatDate } from "@/lib/dates";
import { formatDaysArabic } from "@/lib/format";

import { useLicense } from "../hooks/useSettings";
import { isLicenseActive, licenseKindLabel } from "../lib/settingsFormat";

export function LicenseSection() {
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
            {licenseKindLabel(l)}
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
      {plan && (
        <div className="flex gap-2">
          <dt className="text-muted-foreground">الخطة</dt>
          <dd className="font-medium">«{plan.name}»</dd>
        </div>
      )}
      <div className="space-y-2 border-t pt-3 sm:col-span-2">
        <p className="text-muted-foreground">
          {plan?.isFree
            ? "للترقية: أرسل رقم الجهاز أعلاه لفريق Dealzora، والصق المفتاح الذي يصلك هنا."
            : "للتجديد أو تغيير الخطة: أرسل رقم الجهاز لفريق Dealzora، والصق المفتاح الجديد هنا."}
        </p>
        <ActivateForm />
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
      // Rust يعيد تشغيل الخادم بالخطة الجديدة: ننتظره ثم نحدّث كل البيانات.
      await waitForLocalBackend();
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
