"use client";

import {
  IconArrowRight,
  IconBuildingStore,
  IconHourglass,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";
import { isTauri } from "@tauri-apps/api/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_ROUTES } from "@/features/auth/config/authRoutes";
import {
  getLicenseStatus,
  LicenseError,
  startTrial,
} from "@/features/setup/lib/license";
import { extractErrorMessage } from "@/lib/errors";

import {
  DEFAULT_SYNC_URL,
  joinBranch,
  joinBranchSync,
} from "../api/branchTransfers.api";
import { SyncUrlMissing } from "./syncUrlMissing";

/**
 * أول تشغيل على جهاز فرع جديد: يُربط بكود من المالك بدلاً من إنشاء محل.
 * الجهاز يرث خطة المحل، ويصله حساب المالك والأصناف والعملاء، ثم يدخل المالك وينشئ مدير الفرع.
 */
export function JoinBranchScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [waiting, setWaiting] = useState<string | null>(null); // اسم الفرع: انضم وننتظر حساب المالك

  function done(shopName?: string | null) {
    toast.success(`أصبح هذا الجهاز فرعاً في «${shopName ?? "المحل"}»`, {
      description:
        "سجّل الدخول بحساب المالك، ثم أنشئ مدير الفرع والكاشيرية من «المستخدمون».",
      duration: 10_000,
    });
    router.replace(AUTH_ROUTES.login);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending || code.replace(/[^A-Za-z0-9]/g, "").length < 12) return;
    setPending(true);
    try {
      // جهاز جديد: نبدأ الترخيص المجاني المحلي (للكتابة)، والخطة الحقيقية تأتي من المحل.
      const status = await getLicenseStatus();
      if (status.state === "not_started") await startTrial("فرع");
      const r = await joinBranch(code.trim(), DEFAULT_SYNC_URL);
      if (r.ownerReady) done(r.shopName);
      else setWaiting(r.branchName ?? "");
    } catch (err) {
      toast.error(
        err instanceof LicenseError
          ? err.message
          : extractErrorMessage(err, "تعذّر ربط الفرع"),
      );
    } finally {
      setPending(false);
    }
  }

  async function retry() {
    setPending(true);
    try {
      const r = await joinBranchSync();
      if (r.ownerReady) done(r.shopName);
      else
        toast.info(
          "لم يصل حساب المالك بعد. تأكد أن جهاز المالك مفتوح ومتصل بالإنترنت",
        );
    } catch (err) {
      toast.error(extractErrorMessage(err, "تعذّرت المزامنة"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 border bg-card p-6">
        <header className="space-y-1.5 text-center">
          <IconBuildingStore className="mx-auto size-9 text-primary" />
          <h1 className="text-lg font-bold">ربط فرع جديد بمحل موجود</h1>
          <p className="text-sm text-muted-foreground">
            هذا الجهاز سيصبح فرعاً في محل مسجّل: يأخذ أصناف المحل وعملاءه وخطته،
            وله مخزونه ومبيعاته الخاصة.
          </p>
        </header>

        {!DEFAULT_SYNC_URL ? (
          <SyncUrlMissing />
        ) : waiting !== null ? (
          <div className="space-y-3 text-center">
            <IconHourglass className="mx-auto size-8 text-warning" />
            <p className="text-sm">
              رُبط الجهاز{waiting ? ` كفرع «${waiting}»` : ""}، لكن حساب المالك
              لم يصل بعد.
            </p>
            <p className="text-xs text-muted-foreground">
              افتح البرنامج على جهاز المالك الرئيسي واتركه متصلاً بالإنترنت
              دقيقة، ثم اضغط «إعادة المحاولة».
            </p>
            <Button
              className="w-full gap-2"
              disabled={pending}
              onClick={() => void retry()}
            >
              {pending ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconRefresh className="size-4" />
              )}
              إعادة المحاولة
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <ol className="list-decimal space-y-1 border bg-muted/30 py-2 ps-8 pe-3 text-xs text-muted-foreground">
              <li>
                على جهاز المالك الرئيسي: الإعدادات ← الأجهزة والحماية ← الفروع ←
                «إضافة فرع».
              </li>
              <li>اكتب كود الربط الذي ظهر هناك (صالح دقائق ولمرة واحدة).</li>
              <li>بعدها يسجّل المالك الدخول هنا بحسابه وينشئ مدير الفرع.</li>
            </ol>

            {!isTauri() && (
              <p role="alert" className="text-xs text-warning">
                الربط يعمل من تطبيق سطح المكتب فقط.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="jb-code">كود الربط</Label>
              <Input
                id="jb-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                dir="ltr"
                autoComplete="off"
                autoFocus
                className="h-11 text-center font-mono text-lg tracking-widest"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full gap-2"
              disabled={
                pending || code.replace(/[^A-Za-z0-9]/g, "").length < 12
              }
            >
              {pending ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconBuildingStore className="size-4" />
              )}
              {pending ? "جارٍ الربط وسحب بيانات المحل…" : "ربط هذا الفرع"}
            </Button>
          </form>
        )}

        <div className="flex items-center justify-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
          محل جديد؟
          <Link
            href="/setup"
            className="inline-flex items-center gap-1 font-medium text-primary"
          >
            ارجع لإعداد محل جديد
            <IconArrowRight className="size-3.5 rotate-180" />
          </Link>
        </div>
      </div>
    </main>
  );
}
