"use client";

import {
  IconCopy,
  IconKey,
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlugConnectedX,
  IconPlus,
} from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppTooltip } from "@/components/shared/AppTooltip";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime, formatWhen } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { PairingCode, ShopBranch } from "../api/branchTransfers.api";
import {
  useShopBranchActions,
  useShopBranches,
  useShopInfo,
} from "../hooks/useBranchTransfers";

function CodeDialog({
  code,
  onClose,
}: {
  code: PairingCode | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={code !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-start">
          <DialogTitle>كود ربط فرع «{code?.branchName}»</DialogTitle>
          <DialogDescription>
            اكتبه في برنامج الفرع: الإعدادات ← الأجهزة والحماية ← الفروع ← «فرع
            تابع». صالح لمرة واحدة فقط.
          </DialogDescription>
        </DialogHeader>
        <button
          type="button"
          dir="ltr"
          onClick={() => {
            if (!code) return;
            void navigator.clipboard
              ?.writeText(code.code)
              .then(() => toast.success("نُسخ الكود"));
          }}
          className="flex items-center justify-center gap-2 border-2 border-dashed border-primary/50 bg-primary/5 py-4 font-mono text-2xl font-bold tracking-widest text-primary"
        >
          {code?.code}
          <IconCopy className="size-5" />
        </button>
        {code && (
          <p className="text-center text-xs text-muted-foreground">
            صالح حتى {formatDateTime(Date.parse(code.expiresAt))}
          </p>
        )}
        <Button onClick={onClose}>تم</Button>
      </DialogContent>
    </Dialog>
  );
}

function AddBranchDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: PairingCode) => void;
}) {
  const { create } = useShopBranchActions();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const valid = name.trim().length >= 2 && /^[A-Za-z0-9]{1,12}$/.test(code);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    create.mutate(
      { name: name.trim(), code: code.toUpperCase() },
      {
        onSuccess: (r) => {
          setName("");
          setCode("");
          onClose();
          onCreated(r.pairing);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="text-start">
          <DialogTitle>إضافة فرع</DialogTitle>
          <DialogDescription>
            يُصدر له كود ربط فوراً لتكتبه على جهاز الفرع.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nb-name">اسم الفرع</Label>
            <Input
              id="nb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: فرع مدينة نصر"
              maxLength={120}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nb-code">رمز الفرع (حروف إنجليزية أو أرقام)</Label>
            <Input
              id="nb-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="NC"
              dir="ltr"
              maxLength={12}
              className="font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={!valid || create.isPending}
              className="gap-1.5"
            >
              {create.isPending && (
                <IconLoader2 className="size-4 animate-spin" />
              )}
              إضافة وإصدار الكود
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BranchRow({
  b,
  onCode,
  onRevoke,
}: {
  b: ShopBranch;
  onCode: () => void;
  onRevoke: () => void;
}) {
  const { toggle, code } = useShopBranchActions();
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-2 p-2.5",
        !b.isActive && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          b.online ? "bg-success" : "bg-muted-foreground/40",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {b.name}{" "}
          <span className="font-mono text-xs text-muted-foreground">
            {b.code}
          </span>
          {b.isMe && (
            <span className="ms-1.5 bg-primary/10 px-1.5 text-[11px] text-primary">
              الفرع الرئيسي
            </span>
          )}
          {!b.isActive && (
            <span className="ms-1.5 bg-muted px-1.5 text-[11px]">موقوف</span>
          )}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {!b.paired
            ? "لا يوجد جهاز مربوط"
            : b.online
              ? "متصل الآن"
              : b.lastSeenAt
                ? `آخر ظهور ${formatWhen(Date.parse(b.lastSeenAt))}`
                : "لم يتصل بعد"}
        </span>
      </span>
      {!b.isMe && (
        <span className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={!b.isActive || code.isPending}
            onClick={onCode}
          >
            <IconKey className="size-3.5" /> كود ربط
          </Button>
          <AppTooltip message={b.isActive ? "إيقاف الفرع" : "تفعيل الفرع"}>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={b.isActive ? `إيقاف ${b.name}` : `تفعيل ${b.name}`}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: b.id, isActive: !b.isActive })}
            >
              {b.isActive ? (
                <IconPlayerPause className="size-4" />
              ) : (
                <IconPlayerPlay className="size-4" />
              )}
            </Button>
          </AppTooltip>
          {b.paired && (
            <AppTooltip message="إلغاء ربط الجهاز">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`إلغاء ربط جهاز ${b.name}`}
                onClick={onRevoke}
              >
                <IconPlugConnectedX className="size-4 text-destructive" />
              </Button>
            </AppTooltip>
          )}
        </span>
      )}
    </li>
  );
}

/** فروع المحل: إضافة فرع، وكود ربط، وإيقاف، وإلغاء ربط جهاز. من الجهاز الرئيسي للمالك فقط. */
export function ShopBranchesCard() {
  const info = useShopInfo(true);
  const list = useShopBranches(true);
  const { code, revoke } = useShopBranchActions();
  const [adding, setAdding] = useState(false);
  const [shown, setShown] = useState<PairingCode | null>(null);
  const [revoking, setRevoking] = useState<ShopBranch | null>(null);
  const i = info.data;

  return (
    <div className="space-y-3 border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">فروع المحل</p>
          <p className="text-xs text-muted-foreground">
            أضف فرعاً وأصدر له كود ربط، ثم اكتب الكود على جهاز الفرع.
            {i?.licenseExpiresAt &&
              ` الترخيص صالح حتى ${formatDate(Date.parse(i.licenseExpiresAt))}.`}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={Boolean(i && i.branches >= i.maxBranches)}
          onClick={() => setAdding(true)}
        >
          <IconPlus className="size-4" /> إضافة فرع
        </Button>
      </div>

      {list.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : list.isError ? (
        <p className="text-xs text-destructive">تعذّر جلب الفروع من السيرفر.</p>
      ) : (
        <ul className="divide-y border">
          {(list.data ?? []).map((b) => (
            <BranchRow
              key={b.id}
              b={b}
              onCode={() => code.mutate(b.id, { onSuccess: setShown })}
              onRevoke={() => setRevoking(b)}
            />
          ))}
        </ul>
      )}

      <AddBranchDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={setShown}
      />
      <CodeDialog code={shown} onClose={() => setShown(null)} />

      <Dialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader className="text-start">
            <DialogTitle>إلغاء ربط جهاز «{revoking?.name}»؟</DialogTitle>
            <DialogDescription>
              يتوقف جهاز الفرع عن المزامنة والتحويلات فوراً (مثلاً إن ضاع أو سُرق
              أو سيُستبدل). لربط جهاز جديد أصدر كود ربط جديداً.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRevoking(null)}>
              رجوع
            </Button>
            <Button
              variant="destructive"
              disabled={revoke.isPending}
              onClick={() =>
                revoking &&
                revoke.mutate(revoking.id, {
                  onSuccess: () => setRevoking(null),
                })
              }
            >
              إلغاء الربط
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
