"use client";

import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/shared/BrandLogo";
import { Button } from "@/components/ui/button";

interface BackendState {
  state: "running" | "exited" | "not_started" | "external" | "terminal";
  exit_code: number | null;
  log_dir: string | null;
}

const CHECK_EVERY_MS = 2000;
/** بعدها نطمئن المستخدم أن التأخير طبيعي في أول تشغيل. */
const SLOW_HINT_AFTER_MS = 6000;
/** رسائل حالة متتابعة تطمئن المستخدم أن العمل يتقدم؛ تتوقف عند آخر رسالة. */
const STEPS = [
  "تشغيل الخادم المحلي…",
  "فتح قاعدة البيانات المشفّرة…",
  "تحميل بياناتك وإعداداتك…",
  "لحظات ويصبح كل شيء جاهزاً…",
] as const;
const STEP_EVERY_MS = 2500;

/**
 * يظهر أثناء انتظار الخادم المحلي عند فتح البرنامج (أول تشغيل لنسخة الـ exe قد يأخذ ثوانٍ،
 * خصوصاً مع فحص مضاد الفيروسات). لو توقف الخادم نعرض السبب ومكان السجل بدل شاشة معلّقة.
 */
export function BackendStartup({ failed }: { failed: boolean }) {
  const [backend, setBackend] = useState<BackendState | null>(null);
  const [slow, setSlow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_HINT_AFTER_MS);
    const stepTimer = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      STEP_EVERY_MS,
    );
    return () => {
      clearTimeout(timer);
      clearInterval(stepTimer);
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let stopped = false;
    const check = () =>
      invoke<BackendState>("get_backend_state")
        .then((s) => !stopped && setBackend(s))
        .catch(() => undefined);
    void check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  const dead = backend?.state === "exited" || backend?.state === "not_started";

  if (!dead && !failed) {
    return (
      <main
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background p-6 text-center"
      >
        {/* هالة خلفية ناعمة تعطي عمقاً بدون تشتيت */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-primary)_0%,transparent_60%)] opacity-[0.06]"
        />

        <div className="relative flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-500">
          {/* الشعار داخل حلقة دوّارة */}
          <div className="relative grid size-28 place-items-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-primary/10"
            />
            <span
              aria-hidden
              className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary animation-duration-[1.1s]"
            />
            <span
              aria-hidden
              className="absolute inset-3 animate-pulse rounded-full bg-primary/5"
            />
            <BrandLogo variant="icon" className="relative h-12" />
          </div>

          <div className="flex w-64 flex-col items-center gap-3">
            <h1 className="text-base font-semibold tracking-tight">
              جارٍ تشغيل البرنامج
            </h1>

            {/* شريط تقدم غير محدد — يتحرك من اليمين لليسار ليناسب RTL */}
            <div
              dir="ltr"
              aria-hidden
              className="relative h-1 w-full -scale-x-100 overflow-hidden rounded-full bg-muted"
            >
              <span className="absolute inset-y-0 left-0 w-2/5 animate-indeterminate rounded-full bg-primary" />
            </div>

            <p
              key={step}
              className="h-5 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              {STEPS[step]}
            </p>
          </div>

          {slow && (
            <div className="flex max-w-xs items-start gap-2 rounded-lg border bg-card/60 p-3 text-start text-xs leading-relaxed text-muted-foreground backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
              <IconInfoCircle
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              <span>
                أول تشغيل قد يستغرق حتى دقيقة بينما يجهّز البرنامج قاعدة بياناتك
                المشفّرة. <strong className="font-medium text-foreground">لا تغلق النافذة.</strong>
              </span>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div
        role="alert"
        className="max-w-md space-y-3 border bg-card p-6 text-center"
      >
        <IconAlertTriangle className="mx-auto size-10 text-destructive" />
        <h1 className="text-lg font-semibold">تعذّر تشغيل الخادم المحلي</h1>
        <p className="text-sm text-muted-foreground">
          {backend?.state === "not_started"
            ? "لم يبدأ الخادم المحلي. قد يكون ملف البرنامج ناقصاً أو حذفه مضاد الفيروسات."
            : backend?.state === "exited"
              ? "توقف الخادم المحلي بعد تشغيله مباشرة. غالباً قاعدة البيانات لا تفتح بمفتاح هذا الجهاز، أو برنامج آخر يستخدم المنفذ 8000."
              : "الخادم المحلي لا يرد. تأكد أن البرنامج غير مفتوح مرتين."}
        </p>
        <ol className="list-decimal space-y-1 ps-5 text-start text-xs text-muted-foreground">
          <li>أغلق البرنامج تماماً وافتحه من جديد.</li>
          <li>لو تكررت المشكلة، أرسل للدعم ملفّي السجل من المجلد:</li>
        </ol>
        {backend?.log_dir && (
          <bdi
            dir="ltr"
            className="block break-all border bg-muted/40 px-2 py-1 font-mono text-xs"
          >
            {backend.log_dir}
          </bdi>
        )}
        <Button
          size="lg"
          className="w-full"
          onClick={() => window.location.reload()}
        >
          إعادة المحاولة
        </Button>
      </div>
    </main>
  );
}
