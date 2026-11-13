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
import { useFeature } from "@/lib/plan";

import { fetchBranchStatus } from "../api/branchTransfers.api";
import {
  branchKeys,
  useBranchStatus,
  useConnectBranch,
  useDisconnectBranch,
  useRetryPending,
} from "../hooks/useBranchTransfers";
import { CatalogSyncCard } from "./catalogSyncCard";

/** ربط هذا الجهاز بسيرفر الفروع (مرة واحدة بكود)، وحالة الاتصال. */
export function BranchConnectSection() {
  const allowed = useFeature("branches");
  const status = useBranchStatus();
  const connect = useConnectBranch();
  const disconnect = useDisconnectBranch();
  const retry = useRetryPending();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
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
    if (url.trim() && code.trim())
      connect.mutate(
        { serverUrl: url.trim(), code: code.trim() },
        { onSuccess: () => setCode("") },
      );
  }

  if (!s) return <p className="text-xs text-muted-foreground">جارِ التحميل…</p>;

  if (!s.connected) {
    return (
      <form onSubmit={submit} className="space-y-4">
        {!allowed && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <PlanLock feature="branches" /> تعدد الفروع متاح في خطة «سلسلة».
          </p>
        )}
        <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>
            اطلب من مسؤول البرنامج «كود ربط» لهذا الفرع (صالح دقائق ولمرة
            واحدة).
          </li>
          <li>اكتب عنوان سيرفر الفروع والكود هنا.</li>
        </ol>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bs-url">عنوان سيرفر الفروع</Label>
            <Input
              id="bs-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://sync.example.com"
              dir="ltr"
              className="h-10 font-mono"
              disabled={!allowed}
            />
            <p className="text-[11px] text-muted-foreground">
              للتجربة على نفس الجهاز: http://localhost:8001
            </p>
          </div>
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
              !url.trim() ||
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

      {s.pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-warning/40 bg-warning/5 p-3 text-sm">
          <span>
            {s.pending} تحويل اتخصم من المخزون ولسه ما اتبعتش (انقطاع النت).
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
              مش هتقدر تبعت أو تستلم تحويلات لحد ما تربطه تاني بكود جديد.
              {s.pending > 0 && " فيه تحويلات معلّقة لسه ما اتبعتتش!"}
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
