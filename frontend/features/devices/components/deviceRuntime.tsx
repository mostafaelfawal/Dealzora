"use client";

import {
  IconPlugConnectedX,
  IconRefresh,
  IconWifiOff,
} from "@tabler/icons-react";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  disconnectFromMain,
  getDeviceConfig,
  getLicenseLease,
  isTerminal,
  useDeviceConfig,
} from "@/lib/device";
import {
  DEVICE_UNPAIRED_EVENT,
  MAIN_CONNECTION_EVENT,
  TERMINALS_DISABLED_EVENT,
} from "@/lib/axios";
import { isRealtimeConnected } from "@/lib/realtime";

import { pingMain, sendLease } from "../api/devices.api";

const LEASE_EVERY_MS = 2 * 60_000; // العقد 15 دقيقة: نجدد قبله بكثير
const LEASE_RETRY_MS = 5_000; // الـ backend قد يحتاج ثوانٍ ليقلع
const PING_EVERY_MS = 5_000;

/**
 * الجهاز الأساسي: يجدد عقد ترخيص أجهزة الكاشير طالما البرنامج مفتوح (حتى على شاشة الدخول).
 * لو أُغلق البرنامج أو انتهى الترخيص يتوقف التجديد، فتصبح أجهزة الكاشير للقراءة فقط خلال دقائق.
 */
function LeaseKeeper() {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function renew() {
      let ok = false;
      try {
        await sendLease(await getLicenseLease());
        ok = true;
      } catch {
        // ترخيص غير فعال أو الـ backend لم يقلع بعد: نعيد المحاولة.
      }
      if (!stopped)
        timer = setTimeout(renew, ok ? LEASE_EVERY_MS : LEASE_RETRY_MS);
    }
    void renew();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);
  return null;
}

/**
 * جهاز الكاشير: شريط واضح عند انقطاع الاتصال بالجهاز الأساسي (الفاتورة الحالية محفوظة على هذا الجهاز
 * والدفع يتم أول ما يرجع الاتصال)، وشاشة عند إلغاء اقتران هذا الجهاز.
 */
function TerminalStatus() {
  const [online, setOnline] = useState(true);
  const [unpaired, setUnpaired] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const onConn = (e: Event) => setOnline((e as CustomEvent<boolean>).detail);
    const onUnpaired = () => setUnpaired(true);
    const onDisabled = () => setDisabled(true);
    window.addEventListener(TERMINALS_DISABLED_EVENT, onDisabled);
    window.addEventListener(MAIN_CONNECTION_EVENT, onConn);
    window.addEventListener(DEVICE_UNPAIRED_EVENT, onUnpaired);
    // فحص دوري: يكتشف الانقطاع حتى لو الكاشير لا يفعل شيئاً، ويكتشف رجوع الاتصال.
    // مع البث اللحظي (بعد الدخول) نبضاته تكفي، فلا نرسل ping.
    const ping = setInterval(() => {
      if (!isRealtimeConnected()) void pingMain().catch(() => undefined);
    }, PING_EVERY_MS);
    return () => {
      window.removeEventListener(MAIN_CONNECTION_EVENT, onConn);
      window.removeEventListener(DEVICE_UNPAIRED_EVENT, onUnpaired);
      window.removeEventListener(TERMINALS_DISABLED_EVENT, onDisabled);
      clearInterval(ping);
    };
  }, []);

  if (disabled && !unpaired) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6"
      >
        <div className="max-w-sm space-y-3 text-center">
          <IconPlugConnectedX className="mx-auto size-10 text-warning" />
          <h2 className="text-lg font-semibold">أجهزة الكاشير متوقفة</h2>
          <p className="text-sm text-muted-foreground">
            اشتراك المحل انتهى (أو الخطة لا تشمل أجهزة كاشير)، فالبيع الآن من
            الجهاز الأساسي فقط. بعد التجديد هذا الجهاز يرجع يشتغل تلقائياً.
          </p>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            إعادة المحاولة بعد التجديد
          </Button>
        </div>
      </div>
    );
  }

  if (unpaired) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6"
      >
        <div className="max-w-sm space-y-3 text-center">
          <IconPlugConnectedX className="mx-auto size-10 text-destructive" />
          <h2 className="text-lg font-semibold">تم إلغاء ربط هذا الجهاز</h2>
          <p className="text-sm text-muted-foreground">
            المدير ألغى اقتران هذا الجهاز من الجهاز الأساسي. اطلب منه كود اقتران
            جديد لإعادة الربط.
          </p>
          <Button
            size="lg"
            className="w-full"
            disabled={resetting}
            onClick={async () => {
              // نمسح الاقتران القديم (التوكن الملغى) وإلا يرجع الـ ping يكتشفه ويفتح الشاشة تاني.
              setResetting(true);
              try {
                await disconnectFromMain(); // يعيد تشغيل البرنامج كجهاز مستقل
              } catch {
                window.location.replace("/connect");
              }
            }}
          >
            إعادة الربط بكود جديد
          </Button>
        </div>
      </div>
    );
  }

  if (online) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm text-destructive-foreground shadow"
    >
      <IconWifiOff className="size-4 shrink-0" />
      <span>
        غير متصل بالجهاز الأساسي. الفاتورة الحالية محفوظة هنا، والدفع يتم أول ما
        يرجع الاتصال.
      </span>
      <IconRefresh className="size-4 shrink-0 animate-spin" aria-hidden />
    </div>
  );
}

/** يُركّب مرة في AppProviders: يختار السلوك حسب وضع الجهاز. */
export function DeviceRuntime() {
  const cfg = useDeviceConfig();
  useEffect(() => void getDeviceConfig(), []);
  if (!cfg) return null;
  if (isTerminal(cfg)) return <TerminalStatus />;
  // تطبيق سطح المكتب فقط (المتصفح أثناء التطوير لا يملك Rust).
  return isTauri() ? <LeaseKeeper /> : null;
}
