"use client";

import {
  IconAlertTriangle,
  IconArrowRight,
  IconDeviceDesktop,
  IconLoader2,
  IconPlugConnected,
} from "@tabler/icons-react";
import { isTauri } from "@tauri-apps/api/core";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_ROUTES } from "@/features/auth/config/authRoutes";
import { clearSession } from "@/features/auth/lib/authStorage";
import { connectToMain, MAIN_PORT, normalizeMainUrl } from "@/lib/device";

import { helloMain, PairError, pairWithMain } from "../api/devices.api";

type Step = "idle" | "checking" | "pairing" | "restarting";

/** ربط هذا الجهاز كجهاز كاشير بالجهاز الأساسي في المحل. */
export function ConnectScreen() {
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = step !== "idle";
  const ready =
    address.trim() && /^\d{6}$/.test(code) && name.trim().length >= 2;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setError(null);

    const mainUrl = normalizeMainUrl(address);
    if (!mainUrl) {
      setError("العنوان غير صحيح. اكتبه مثل 192.168.1.10");
      return;
    }
    setStep("checking");
    if (!(await helloMain(mainUrl))) {
      setStep("idle");
      setError(
        "لم نجد البرنامج على هذا العنوان. تأكد أن البرنامج مفتوح على الجهاز الأساسي، " +
          "وأن «السماح لأجهزة الكاشير» مفعّل في إعداداته، وأن الجهازين على نفس الشبكة.",
      );
      return;
    }
    setStep("pairing");
    try {
      const paired = await pairWithMain(mainUrl, code, name.trim());
      setStep("restarting");
      // يحفظ الإعداد ويوقف الـ backend المحلي، ثم تحميل كامل ليقرأ وضع «جهاز كاشير».
      await connectToMain(mainUrl, paired.device_token, paired.name);
      clearSession();
      window.location.replace(AUTH_ROUTES.login);
    } catch (e) {
      setStep("idle");
      setError(
        e instanceof PairError ? e.message : "تعذّر حفظ الربط على هذا الجهاز",
      );
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-4 border bg-card p-6"
      >
        <header className="space-y-1.5 text-center">
          <IconPlugConnected className="mx-auto size-9 text-primary" />
          <h1 className="text-lg font-bold">ربط جهاز كاشير</h1>
          <p className="text-sm text-muted-foreground">
            هذا الجهاز سيعمل على بيانات الجهاز الأساسي في المحل (نفس الأصناف
            والمخزون والعملاء)، وله درج ووردية خاصة به.
          </p>
        </header>

        <ol className="list-decimal space-y-1 border bg-muted/30 py-2 ps-8 pe-3 text-xs text-muted-foreground">
          <li>
            على الجهاز الأساسي: الإعدادات ← أجهزة الكاشير ← فعّل «السماح لأجهزة
            الكاشير».
          </li>
          <li>اضغط «إنشاء كود اقتران» واكتب العنوان والكود هنا.</li>
        </ol>

        {!isTauri() && (
          <p role="alert" className="text-xs text-warning">
            الربط يعمل من تطبيق سطح المكتب فقط.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="main-address">عنوان الجهاز الأساسي</Label>
          <Input
            id="main-address"
            dir="ltr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={`192.168.1.10  (أو 192.168.1.10:${MAIN_PORT})`}
            autoComplete="off"
            disabled={busy}
            autoFocus
            className="h-11 font-mono"
          />
        </div>

        <div className="grid grid-cols-[8rem_1fr] gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="pair-code">كود الاقتران</Label>
            <Input
              id="pair-code"
              dir="ltr"
              inputMode="numeric"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              autoComplete="one-time-code"
              disabled={busy}
              className="h-11 text-center font-mono text-lg tracking-[0.3em]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="device-name">اسم هذا الجهاز</Label>
            <Input
              id="device-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: كاشير 2"
              maxLength={40}
              disabled={busy}
              className="h-11"
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 text-sm text-destructive"
          >
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="h-11 w-full gap-2"
          disabled={!ready || busy || !isTauri()}
        >
          {busy ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconPlugConnected className="size-4" />
          )}
          {step === "checking"
            ? "جارٍ البحث عن الجهاز الأساسي…"
            : step === "pairing"
              ? "جارٍ الربط…"
              : step === "restarting"
                ? "تم الربط، جارٍ الفتح…"
                : "ربط هذا الجهاز"}
        </Button>

        <div className="flex items-center justify-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
          <IconDeviceDesktop className="size-4" />
          هذا هو الجهاز الأساسي؟
          <Link
            href={AUTH_ROUTES.login}
            className="inline-flex items-center gap-1 font-medium text-primary"
          >
            ارجع لتسجيل الدخول
            <IconArrowRight className="size-3.5 rotate-180" />
          </Link>
        </div>
      </form>
    </main>
  );
}
