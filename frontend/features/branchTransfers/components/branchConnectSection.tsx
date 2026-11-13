"use client";

import {
  IconCircleCheck,
  IconCloudOff,
  IconLink,
  IconLoader2,
  IconPlugConnectedX,
  IconRefresh,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { PlanLock } from "@/components/shared/PlanGate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isOwner } from "@/config/roles";
import { useSessionUser } from "@/hooks/useShellData";
import { useFeature } from "@/lib/plan";

import {
  DEFAULT_SYNC_URL,
  fetchBranchStatus,
} from "../api/branchTransfers.api";
import {
  branchKeys,
  useBranchStatus,
  useConnectBranch,
  useDisconnectBranch,
  useRetryPending,
} from "../hooks/useBranchTransfers";
import { CatalogSyncCard } from "./catalogSyncCard";
import { RegisterShopForm } from "./registerShopForm";
import { SyncUrlMissing } from "./syncUrlMissing";
import { ShopBranchesCard } from "./shopBranchesCard";

/** ربط هذا الجهاز بسيرفر الفروع (مرة واحدة بكود)، وحالة الاتصال. */
export function BranchConnectSection() {
  const planAllowed = useFeature("branches");
  // ربط الفرع وفصله لمالك المحل بس (الـ backend بيفرضها كمان).
  const owner = isOwner(useSessionUser().role);
  const allowed = planAllowed && owner;
  const status = useBranchStatus();
  const connect = useConnectBranch();
  const disconnect = useDisconnectBranch();
  const retry = useRetryPending();
  const qc = useQueryClient();
  // جهاز المالك الرئيسي يسجّل المحل، وجهاز أي فرع آخر يربط بكود من المالك.
  const [mode, setMode] = useState<"join" | "register">("register");
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const s = status.data;

  async function test() {
    setChecking(true);
    try {
      qc.setQueryData(branchKeys.status(), await fetchBranchStatus(true));
    } finally {
      setChecking(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (DEFAULT_SYNC_URL && code.trim())
      connect.mutate(
        { serverUrl: DEFAULT_SYNC_URL, code: code.trim() },
        { onSuccess: () => setCode("") },
      );
  }

  if (!s) return <p className="text-xs text-muted-foreground">جارِ التحميل…</p>;

  if (!s.connected) {
    const modes = (
      <div
        role="group"
        aria-label="نوع الربط"
        className="grid grid-cols-2 gap-2"
      >
        {(
          [
            [
              "register",
              "محل جديد (أنا المالك)",
              "هذا الجهاز الرئيسي ومعي مفتاح الترخيص",
            ],
            ["join", "فرع تابع", "معي كود ربط من جهاز المالك"],
          ] as const
        ).map(([id, title, hint]) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => setMode(id)}
            className={
              "border p-2.5 text-start " +
              (mode === id ? "border-primary bg-primary/5" : "hover:bg-muted")
            }
          >
            <span className="block text-sm font-medium">{title}</span>
            <span className="text-[11px] text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>
    );
    if (mode === "register")
      return (
        <div className="space-y-4">
          {!planAllowed && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <PlanLock feature="branches" /> تعدد الفروع متاح في خطة «سلسلة».
            </p>
          )}
          {planAllowed && !owner && (
            <p className="text-xs text-muted-foreground">
              تسجيل المحل متاح لحساب <b>مالك المحل</b> فقط.
            </p>
          )}
          {modes}
          <RegisterShopForm allowed={allowed} />
        </div>
      );
    if (!DEFAULT_SYNC_URL)
      return (
        <div className="space-y-4">
          {modes}
          <SyncUrlMissing />
        </div>
      );
    return (
      <form onSubmit={submit} className="space-y-4">
        {modes}
        {planAllowed && !owner && (
          <p className="text-xs text-muted-foreground">
            ربط الفرع بسيرفر الفروع متاح لحساب <b>مالك المحل</b> فقط.
          </p>
        )}
        {!planAllowed && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PlanLock feature="branches" /> تعدد الفروع متاح في خطة «سلسلة».
          </p>
        )}
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>
            اطلب من مالك المحل «كود ربط» لهذا الفرع من جهازه الرئيسي (صالح دقائق
            ولمرة واحدة).
          </li>
          <li>اكتب الكود هنا.</li>
        </ol>
        <div className="max-w-xs">
          <div className="space-y-1.5">
            <Label htmlFor="bs-code">كود الربط</Label>
            <Input
              id="bs-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              dir="ltr"
              autoComplete="off"
              className="h-10 font-mono tracking-widest"
              disabled={!allowed}
            />
          </div>
        </div>
        <div className="flex justify-end border-t pt-3">
          <Button
            type="submit"
            size="lg"
            className="h-10 gap-2"
            disabled={
              !allowed ||
              connect.isPending ||
              !DEFAULT_SYNC_URL ||
              code.trim().length < 12
            }
          >
            {connect.isPending ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconLink className="size-4" />
            )}
            ربط هذا الفرع
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 bg-success/5 p-3">
        <IconCircleCheck className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="min-w-0 space-y-0.5 text-sm">
          <p>
            هذا الجهاز هو فرع <b>{s.branchName}</b>
            {s.branchCode && (
              <span className="font-mono"> ({s.branchCode})</span>
            )}{" "}
            في <b>{s.shopName}</b>
          </p>
          <p
            dir="ltr"
            className="truncate text-start font-mono text-xs text-muted-foreground"
          >
            {s.serverUrl}
          </p>
          {s.reachable === false && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <IconCloudOff className="size-3.5" /> السيرفر غير متاح الآن
            </p>
          )}
          {s.reachable === true && (
            <p className="text-xs text-success">الاتصال بالسيرفر سليم</p>
          )}
        </div>
      </div>

      <CatalogSyncCard />

      {s.isAdmin && owner && <ShopBranchesCard />}

      {s.pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-warning/40 bg-warning/5 p-3 text-sm">
          <span>
            {s.pending} تحويل خُصم من المخزون ولم يُرسل بعد (انقطاع الإنترنت).
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={retry.isPending}
            onClick={() => retry.mutate()}
          >
            <IconRefresh className="size-4" /> إعادة الإرسال
          </Button>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={checking}
          onClick={() => void test()}
        >
          {checking ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconRefresh className="size-4" />
          )}
          اختبار الاتصال
        </Button>
        <Button
          variant="ghost"
          className="gap-1.5 text-destructive"
          disabled={!owner}
          title={owner ? undefined : "لمالك المحل فقط"}
          onClick={() => setConfirm(true)}
        >
          <IconPlugConnectedX className="size-4" /> فصل الفرع
        </Button>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader className="text-start">
            <DialogTitle>فصل هذا الجهاز عن سيرفر الفروع؟</DialogTitle>
            <DialogDescription>
              لن تتمكن من إرسال التحويلات أو استلامها حتى تربطه من جديد بكود
              جديد.
              {s.pending > 0 && " توجد تحويلات معلّقة لم تُرسل بعد!"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              رجوع
            </Button>
            <Button
              variant="destructive"
              disabled={disconnect.isPending}
              onClick={() =>
                disconnect.mutate(undefined, {
                  onSuccess: () => setConfirm(false),
                })
              }
            >
              فصل
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
