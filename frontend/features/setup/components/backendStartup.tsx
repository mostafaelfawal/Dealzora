"use client";

import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

interface BackendState {
  state: "running" | "exited" | "not_started" | "external" | "terminal";
  exit_code: number | null;
  log_dir: string | null;
}

const CHECK_EVERY_MS = 2000;

/**
 * يظهر أثناء انتظار الخادم المحلي عند فتح البرنامج (أول تشغيل لنسخة الـ exe قد يأخذ ثوانٍ،
 * خصوصاً مع فحص مضاد الفيروسات). لو توقف الخادم نعرض السبب ومكان السجل بدل شاشة معلّقة.
 */
export function BackendStartup({ failed }: { failed: boolean }) {
  const [backend, setBackend] = useState<BackendState | null>(null);

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
        className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background text-muted-foreground"
      >
        <IconLoader2 className="size-7 animate-spin" />
        <p className="text-sm">جارٍ تشغيل البرنامج…</p>
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
