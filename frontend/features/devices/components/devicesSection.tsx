"use client";

import {
  IconAlertTriangle,
  IconDeviceDesktop,
  IconKey,
  IconLoader2,
  IconPlugConnectedX,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { UpgradeNotice } from "@/components/shared/PlanGate";
import { Button } from "@/components/ui/button";
import { useFeature } from "@/lib/plan";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useNow } from "@/hooks/useNow";
import { formatMinutesAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

import { AUTH_ROUTES } from "@/features/auth/config/authRoutes";
import { clearSession } from "@/features/auth/lib/authStorage";
import {
  disconnectFromMain,
  setLanEnabled,
  waitForLocalBackend,
} from "@/lib/device";

import type { NetworkInfo, PairedDevice } from "../api/devices.api";
import {
  deviceKeys,
  useCreatePairingCode,
  useNetwork,
  useRevokeDevice,
} from "../hooks/useDevices";

/** الجهاز الأساسي: السماح لأجهزة الكاشير، كود الاقتران، وقائمة الأجهزة. */
export function DevicesSection() {
  const allowed = useFeature("terminals");
  return allowed ? (
    <DevicesPanel />
  ) : (
    <UpgradeNotice feature="terminals" className="border-0 p-2" />
  );
}

function DevicesPanel() {
  const network = useNetwork();
  const n = network.data;

  if (network.isPending) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <IconLoader2 className="size-4 animate-spin" /> جارٍ التحميل…
      </p>
    );
  }
  if (!n) {
    return (
      <p role="alert" className="text-xs text-destructive">
        تعذّر تحميل إعدادات الأجهزة.
      </p>
    );
  }

  const used = n.devices.length;
  const max = n.maxTerminals;

  return (
    <div className="space-y-3">
      <LanToggle enabled={n.lanEnabled} />

      {n.lanEnabled && (
        <>
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              عنوان هذا الجهاز (يُكتب في جهاز الكاشير):
            </p>
            {n.addresses.length ? (
              <div className="flex flex-wrap gap-2">
                {n.addresses.map((a) => (
                  <bdi
                    key={a}
                    dir="ltr"
                    className="border bg-muted/40 px-2 py-1 font-mono text-sm font-medium"
                  >
                    {a}
                    {n.port !== 8000 ? `:${n.port}` : ""}
                  </bdi>
                ))}
              </div>
            ) : (
              <p className="text-warning">
                لم نجد عنوان شبكة. تأكد أن الجهاز متصل بالراوتر (سلك أو واي
                فاي).
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
            <span>
              أجهزة الكاشير:{" "}
              <b className="font-mono">
                {used}
                {max !== null ? ` / ${max}` : ""}
              </b>
              {max !== null && max === 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  — ترخيصك لا يشمل أجهزة كاشير إضافية. تواصل معنا للترقية.
                </span>
              )}
            </span>
            <PairingCode disabled={max !== null && used >= max} />
          </div>

          {n.devices.length > 0 && (
            <ul className="divide-y border text-xs">
              {n.devices.map((d) => (
                <DeviceRow key={d.id} device={d} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function LanToggle({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  async function toggle(next: boolean) {
    const msg = next
      ? "البرنامج هيقبل أجهزة الكاشير على شبكة المحل (ثوانٍ قليلة).\n\nلو ظهرت رسالة من ويندوز (Windows Firewall) اختر «السماح» على الشبكات الخاصة (Private). متابعة؟"
      : "كل أجهزة الكاشير هتتوقف عن الاتصال. متابعة؟";
    if (!window.confirm(msg)) return;
    setPending(true);
    try {
      await setLanEnabled(next); // يعيد تشغيل الـ backend فقط، والجلسة تبقى
      const back = await waitForLocalBackend();
      await qc.invalidateQueries({ queryKey: deviceKeys.network });
      const now = qc.getQueryData<NetworkInfo>(deviceKeys.network);
      if (!back) {
        toast.error(
          "الخادم المحلي تأخر في الرجوع. أغلق البرنامج وافتحه من جديد",
        );
      } else if (now && now.lanEnabled !== next) {
        // وضع التطوير: الـ backend يعمل من VS Code ولا يعيد Rust تشغيله.
        toast.info("لم يتغير وضع الشبكة", {
          description:
            process.env.NODE_ENV === "development"
              ? "في التطوير: اضبط POS_HOST=0.0.0.0 في ملف .env للـ backend وأعد تشغيله."
              : "أغلق البرنامج وافتحه من جديد.",
          duration: 10_000,
        });
      } else {
        toast.success(
          next
            ? "أجهزة الكاشير يمكنها الاتصال الآن"
            : "تم إيقاف اتصال أجهزة الكاشير",
        );
      }
    } catch {
      toast.error("تعذّر تغيير الإعداد");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <Label htmlFor="lan-enabled">السماح لأجهزة الكاشير بالاتصال</Label>
        <p className="text-xs text-muted-foreground">
          كل الأجهزة تعمل على بيانات هذا الجهاز. يجب ان يكون مفتوحاً طول وقت
          البيع.
        </p>
      </div>
      <Switch
        id="lan-enabled"
        checked={enabled}
        disabled={pending}
        onCheckedChange={(v) => void toggle(v)}
      />
    </div>
  );
}

function PairingCode({ disabled }: { disabled: boolean }) {
  const create = useCreatePairingCode();
  const now = useNow(1000);
  const data = create.data;
  const left =
    data && now ? Math.max(0, Math.round((data.expiresAt - now) / 1000)) : 0;
  const active = data && left > 0;

  return (
    <div className="flex items-center gap-2">
      {active && (
        <span className="flex items-baseline gap-2">
          <bdi
            dir="ltr"
            className="font-mono text-2xl font-bold tracking-[0.25em]"
          >
            {data.code}
          </bdi>
          <span className="font-mono text-muted-foreground tabular-nums">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
        </span>
      )}
      <Button
        type="button"
        variant={active ? "ghost" : "default"}
        size="sm"
        disabled={disabled || create.isPending}
        onClick={() => create.mutate()}
        className="gap-1.5"
      >
        {create.isPending ? (
          <IconLoader2 className="size-3.5 animate-spin" />
        ) : (
          <IconKey className="size-3.5" />
        )}
        {active ? "كود جديد" : "إنشاء كود اقتران"}
      </Button>
    </div>
  );
}

function DeviceRow({ device }: { device: PairedDevice }) {
  const revoke = useRevokeDevice();
  const now = useNow(30_000);
  const [confirm, setConfirm] = useState(false);

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <IconDeviceDesktop className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{device.name}</p>
        <p
          className={cn(
            "text-[11px]",
            device.online ? "text-primary" : "text-muted-foreground",
          )}
        >
          {device.online
            ? "● متصل الآن"
            : device.lastSeenAt && now
              ? `آخر اتصال ${formatMinutesAgo(device.lastSeenAt, now)}`
              : "لم يتصل بعد"}
        </p>
      </div>
      {confirm ? (
        <>
          <span className="flex items-center gap-1 text-[11px] text-destructive">
            <IconAlertTriangle className="size-3.5" />
            لن يستطيع البيع بعد الآن
          </span>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate({ id: device.id, name: device.name })}
          >
            تأكيد
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setConfirm(false)}
          >
            إلغاء
          </Button>
        </>
      ) : (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`إلغاء ربط ${device.name}`}
          onClick={() => setConfirm(true)}
          className="text-destructive"
        >
          <IconTrash />
        </Button>
      )}
    </li>
  );
}

/** جهاز الكاشير: بيانات الاتصال وفصل الجهاز. */
export function ThisDeviceSection({
  name,
  mainUrl,
}: {
  name: string | null;
  mainUrl: string | null;
}) {
  const [pending, setPending] = useState(false);

  async function disconnect() {
    if (
      !window.confirm(
        "فصل هذا الجهاز عن الجهاز الأساسي؟\nسيعمل كجهاز مستقل ببياناته المحلية (بدون بيانات المحل)، وستسجّل الدخول من جديد.",
      )
    )
      return;
    setPending(true);
    try {
      await disconnectFromMain();
      await waitForLocalBackend();
      clearSession();
      window.location.replace(AUTH_ROUTES.login); // تحميل كامل: يقرأ وضع الجهاز الجديد
    } catch {
      setPending(false);
      toast.error("تعذّر الفصل");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="space-y-0.5">
        <p>
          جهاز كاشير: <b>{name}</b>
        </p>
        <p className="text-muted-foreground">
          متصل بالجهاز الأساسي{" "}
          <bdi dir="ltr" className="font-mono">
            {mainUrl?.replace(/^https?:\/\//, "")}
          </bdi>
          . النسخ الاحتياطي والترخيص يُداران من الجهاز الأساسي.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => void disconnect()}
        className="gap-1.5 font-normal text-destructive"
      >
        <IconPlugConnectedX className="size-3.5" />
        فصل هذا الجهاز
      </Button>
    </div>
  );
}
