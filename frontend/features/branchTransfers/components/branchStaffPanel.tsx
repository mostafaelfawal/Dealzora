"use client";

import {
  IconLoader2,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useState, type FormEvent } from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { ShopBranch, Staff, StaffRole } from "../api/branchTransfers.api";
import {
  useShopBranches,
  useStaff,
  useStaffActions,
} from "../hooks/useBranchTransfers";

const ROLE_TEXT: Record<StaffRole, string> = {
  manager: "مدير الفرع",
  cashier: "كاشير",
};

function StaffDialog({
  open,
  staff,
  branches,
  onClose,
}: {
  open: boolean;
  /** null = موظف جديد */
  staff: Staff | null;
  branches: ShopBranch[];
  onClose: () => void;
}) {
  const { create, update } = useStaffActions();
  const [username, setUsername] = useState(staff?.username ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>(staff?.role ?? "cashier");
  const [picked, setPicked] = useState<string[]>(staff?.branches ?? []);
  const pending = create.isPending || update.isPending;
  const editing = staff !== null;
  const valid =
    /^[a-z0-9._-]{3,50}$/.test(username.trim().toLowerCase()) &&
    picked.length > 0 &&
    (editing
      ? password.length === 0 || password.length >= 8
      : password.length >= 8);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const name = username.trim().toLowerCase();
    if (staff)
      update.mutate(
        {
          id: staff.id,
          patch: {
            ...(name !== staff.username ? { username: name } : {}),
            ...(password ? { password } : {}),
            ...(role !== staff.role ? { role } : {}),
            branches: picked,
          },
        },
        { onSuccess: onClose },
      );
    else
      create.mutate(
        { username: name, password, role, branches: picked },
        { onSuccess: onClose },
      );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle>
            {editing ? `تعديل «${staff.username}»` : "موظف جديد"}
          </DialogTitle>
          <DialogDescription>
            يصل الحساب لأجهزة الفروع المختارة خلال دقيقة، ويدخل بها حتى بدون
            إنترنت.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="st-user">اسم المستخدم</Label>
              <Input
                id="st-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                dir="ltr"
                autoComplete="off"
                placeholder="ahmed.nasr"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-pass">
                {editing ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}
              </Label>
              <Input
                id="st-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
                autoComplete="new-password"
                placeholder={
                  editing ? "اتركها فارغة لتبقى كما هي" : "8 خانات على الأقل"
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>الدور</Label>
            <div role="group" aria-label="الدور" className="flex gap-1.5">
              {(["cashier", "manager"] as const).map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant={role === r ? "default" : "outline"}
                  aria-pressed={role === r}
                  onClick={() => setRole(r)}
                  className="font-normal"
                >
                  {ROLE_TEXT[r]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {role === "manager"
                ? "مدير واحد فقط لكل فرع: كل الأعمال اليومية وإدارة كاشيرية فرعه."
                : "البيع والوردية فقط. يمكن أن يعمل في أكثر من فرع."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>الفروع التي يعمل بها</Label>
            <ul className="max-h-48 divide-y overflow-y-auto border">
              {branches.map((b) => (
                <li key={b.id}>
                  <label className="flex cursor-pointer items-center gap-2 p-2 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={picked.includes(b.id)}
                      onCheckedChange={() => toggle(b.id)}
                    />
                    <span className="flex-1">{b.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {b.code}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {picked.length === 0 && (
              <p className="text-xs text-destructive">
                اختر فرعاً واحداً على الأقل
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={!valid || pending}
              className="gap-1.5"
            >
              {pending && <IconLoader2 className="size-4 animate-spin" />}
              {editing ? "حفظ التعديلات" : "إضافة الموظف"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** موظفو كل الفروع: المالك يضيف المديرين والكاشيرية ويحدد فروعهم من جهازه الرئيسي. */
export function BranchStaffPanel() {
  const staff = useStaff(true);
  const branchesQ = useShopBranches(true);
  const { update, remove } = useStaffActions();
  const [editing, setEditing] = useState<Staff | null | undefined>(undefined); // undefined = مغلق
  const [deleting, setDeleting] = useState<Staff | null>(null);
  const branches = branchesQ.data ?? [];
  const names = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          أضف مدير كل فرع وكاشيريته من هنا، وحدّد فروع كل موظف. التغيير يصل
          للفروع خلال دقيقة.
        </p>
        <Button
          className="gap-1.5"
          disabled={branches.length === 0}
          onClick={() => setEditing(null)}
        >
          <IconPlus className="size-4" /> موظف جديد
        </Button>
      </div>

      {staff.isPending || branchesQ.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : staff.isError ? (
        <p role="alert" className="text-sm text-destructive">
          تعذّر جلب الموظفين من سيرفر الفروع. تأكد من الاتصال بالإنترنت.
        </p>
      ) : (staff.data ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-2 border border-dashed py-12 text-center">
          <IconUsersGroup className="size-8 text-muted-foreground" />
          <p className="text-sm">لا يوجد موظفون في الفروع بعد</p>
          <p className="text-xs text-muted-foreground">
            ابدأ بإضافة مدير لكل فرع.
          </p>
        </div>
      ) : (
        <ul className="divide-y border">
          {(staff.data ?? []).map((s) => (
            <li
              key={s.id}
              className={cn(
                "flex flex-wrap items-center gap-3 p-3",
                !s.isActive && "opacity-60",
              )}
            >
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <bdi dir="ltr" className="font-mono text-sm font-medium">
                    {s.username}
                  </bdi>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-normal",
                      s.role === "manager" && "border-primary/50 text-primary",
                    )}
                  >
                    {ROLE_TEXT[s.role]}
                  </Badge>
                </span>
                <span className="flex flex-wrap gap-1">
                  {s.branches.map((id) => (
                    <span
                      key={id}
                      className="bg-muted px-1.5 py-0.5 text-[11px]"
                    >
                      {names.get(id) ?? "فرع محذوف"}
                    </span>
                  ))}
                </span>
              </span>
              <AppTooltip
                message={s.isActive ? "إيقاف الحساب" : "تفعيل الحساب"}
              >
                <Switch
                  size="sm"
                  checked={s.isActive}
                  disabled={update.isPending}
                  aria-label={`${s.isActive ? "إيقاف" : "تفعيل"} ${s.username}`}
                  onCheckedChange={(v) =>
                    update.mutate({ id: s.id, patch: { isActive: v } })
                  }
                />
              </AppTooltip>
              <AppTooltip message="تعديل">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`تعديل ${s.username}`}
                  onClick={() => setEditing(s)}
                >
                  <IconPencil className="size-4" />
                </Button>
              </AppTooltip>
              <AppTooltip message="حذف من كل الفروع">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`حذف ${s.username}`}
                  onClick={() => setDeleting(s)}
                >
                  <IconTrash className="size-4 text-destructive" />
                </Button>
              </AppTooltip>
            </li>
          ))}
        </ul>
      )}

      {editing !== undefined && (
        <StaffDialog
          key={editing?.id ?? "new"}
          open
          staff={editing}
          branches={branches}
          onClose={() => setEditing(undefined)}
        />
      )}

      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader className="text-start">
            <DialogTitle>حذف «{deleting?.username}» من كل الفروع؟</DialogTitle>
            <DialogDescription>
              يُحذف حسابه من أجهزة فروعه وتُقفل جلساته. فواتيره ووردياته السابقة
              تبقى في التقارير.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              رجوع
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                deleting &&
                remove.mutate(deleting, { onSuccess: () => setDeleting(null) })
              }
            >
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
