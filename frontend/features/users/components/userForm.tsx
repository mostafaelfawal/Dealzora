"use client";

import { IconDeviceFloppy, IconKey, IconLoader2 } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import type { FieldErrors, Path, PathValue } from "react-hook-form";
import { toast } from "sonner";

import { FieldError } from "@/components/shared/form";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useHotkey } from "@/hooks/useHotkey";
import { cn } from "@/lib/utils";

import { isOwner } from "@/config/roles";
import { useSessionUser } from "@/hooks/useShellData";

import { assignableRoles, ROLE_HELP, ROLE_LABEL } from "../config/userOptions";
import { USER_ROUTES } from "../config/userRoutes";
import { USER_FORM_SHORTCUTS } from "../config/userShortcuts";
import { useUserFormContext } from "../context/UserFormContext";
import useCurrentUserId from "../hooks/useCurrentUserId";
import type { UserSchemaType } from "../schema/user.schema";
import { PasswordField } from "./passwordField";
import { ResetPasswordDialog } from "./resetPasswordDialog";

const FIELD_IDS = {
  username: "uf-username",
  password: "uf-password",
} as const;

const ERROR_ORDER = ["username", "password"] as const;

function focusFirstError(errors: FieldErrors<UserSchemaType>) {
  for (const field of ERROR_ORDER) {
    if (!errors[field]) continue;
    document.getElementById(FIELD_IDS[field])?.focus();
    return;
  }
}

export function UserForm() {
  const { form, userId, userData, onSubmit, isSaving } = useUserFormContext();
  const currentUserId = useCurrentUserId();
  const myRole = useSessionUser().role;
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = form;
  const [pendingAction, setPendingAction] = useState<"save" | "saveAndNew">(
    "save",
  );
  const [resetOpen, setResetOpen] = useState(false);
  const isEditing = Boolean(userId);
  const isSelf = isEditing && userId === currentUserId;
  const values = watch();
  const current = userData.data;

  function setField<P extends Path<UserSchemaType>>(
    name: P,
    value: PathValue<UserSchemaType, P>,
  ) {
    setValue(name, value, { shouldDirty: true, shouldValidate: isSubmitted });
  }

  function submit(andNew: boolean) {
    if (isSaving) return;
    setPendingAction(andNew ? "saveAndNew" : "save");
    void handleSubmit(
      (data) => onSubmit(data, andNew),
      (found) => {
        focusFirstError(found);
        toast.error("راجع الحقول المطلوبة");
      },
    )();
  }

  useHotkey(USER_FORM_SHORTCUTS.save.match, () => submit(false));
  useHotkey(USER_FORM_SHORTCUTS.saveAndNew.match, () => submit(true));

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
      className="mx-auto flex max-w-3xl flex-col gap-5"
    >
      <header className="space-y-1">
        <h1 className="text-lg font-bold">
          {isEditing ? "تعديل مستخدم" : "مستخدم جديد"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {isEditing
            ? "عدّل بيانات المستخدم ثم احفظ."
            : "اكتب اسم الدخول، واختر الدور، وحدّد كلمة المرور."}
        </p>
      </header>

      <section className="space-y-4 border bg-card p-4">
        <h2 className="text-sm font-semibold">بيانات الدخول</h2>

        <div className="space-y-1.5">
          <Label htmlFor="uf-username">اسم المستخدم *</Label>
          <Input
            id="uf-username"
            dir="ltr"
            {...register("username")}
            aria-invalid={Boolean(errors.username)}
            aria-describedby="uf-username-error"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={!isEditing}
            placeholder="cashier1"
            className="font-mono"
          />
          <FieldError
            id="uf-username-error"
            message={errors.username?.message}
          />
          <p className="text-xs text-muted-foreground">
            حروف إنجليزية صغيرة وأرقام و . _ - فقط (من 3 إلى 50 خانة). هذا ما
            سيكتبه الكاشير عند الدخول.
          </p>
        </div>

        {!isEditing && (
          <div className="space-y-1.5">
            <Label htmlFor="uf-password">كلمة المرور *</Label>
            <PasswordField
              id="uf-password"
              value={values.password}
              onChange={(next) => setField("password", next)}
              invalid={Boolean(errors.password)}
              describedBy="uf-password-error"
            />
            <FieldError
              id="uf-password-error"
              message={errors.password?.message}
            />
            <p className="text-xs text-muted-foreground">
              اضغط «توليد» لكلمة قوية، ثم انسخها وأعطها للكاشير.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3 border bg-card p-4">
        <h2 className="text-sm font-semibold">الدور</h2>
        <div role="group" aria-label="الدور" className="flex flex-wrap gap-1.5">
          {(values.role === "owner"
            ? (["owner"] as const)
            : assignableRoles(myRole)
          ).map((role) => (
            <Button
              key={role}
              type="button"
              size="sm"
              variant={values.role === role ? "default" : "outline"}
              aria-pressed={values.role === role}
              disabled={isSelf || values.role === "owner"}
              onClick={() => setField("role", role)}
              className="font-normal"
            >
              {ROLE_LABEL[role]}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {values.role === "owner"
            ? ROLE_HELP.owner
            : isSelf
              ? "لا يمكنك تغيير دور حسابك."
              : !isOwner(myRole)
                ? "يضيف المدير الكاشيرية فقط، أما إضافة مدير للفرع فمن حساب المالك."
                : ROLE_HELP[values.role]}
        </p>
      </section>

      {isEditing && (
        <>
          <section className="flex items-center justify-between gap-3 border bg-card p-4">
            <div className="space-y-0.5">
              <Label htmlFor="uf-active">حساب نشط</Label>
              <p className="text-xs text-muted-foreground">
                {isSelf
                  ? "لا يمكنك تعطيل حسابك."
                  : "الحساب المعطّل لا يستطيع الدخول، وتُنهى جلساته فوراً."}
              </p>
            </div>
            <Switch
              id="uf-active"
              checked={values.isActive}
              disabled={isSelf}
              onCheckedChange={(checked) => setField("isActive", checked)}
            />
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 border bg-card p-4">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold">كلمة المرور</h2>
              <p className="text-xs text-muted-foreground">
                {isSelf
                  ? "كلمة مرورك تتغير من إعدادات حسابك."
                  : "حدّد كلمة مرور جديدة لهذا المستخدم."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isSelf || !current}
              onClick={() => setResetOpen(true)}
              className="gap-2 font-normal"
            >
              <IconKey className="size-4" />
              تغيير كلمة المرور
            </Button>
          </section>
        </>
      )}

      <div
        className={cn(
          "sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur sm:flex-row sm:justify-end",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isSaving}
          nativeButton={false}
          render={<Link href={USER_ROUTES.list} />}
          className="font-normal sm:me-auto"
        >
          إلغاء
        </Button>

        {!isEditing && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isSaving}
            aria-busy={isSaving && pendingAction === "saveAndNew"}
            onClick={() => submit(true)}
            className="gap-2 font-normal"
          >
            {isSaving && pendingAction === "saveAndNew" ? (
              <>
                <IconLoader2 className="size-4 animate-spin" aria-hidden />
                جارٍ الحفظ…
              </>
            ) : (
              <>
                حفظ وإضافة آخر
                <ShortcutBadge className="hidden lg:inline-flex">
                  {USER_FORM_SHORTCUTS.saveAndNew.label}
                </ShortcutBadge>
              </>
            )}
          </Button>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isSaving}
          aria-busy={isSaving && pendingAction === "save"}
          className="gap-2 px-5"
        >
          {isSaving && pendingAction === "save" ? (
            <>
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
              جارٍ الحفظ…
            </>
          ) : (
            <>
              <IconDeviceFloppy className="size-4" aria-hidden />
              {isEditing ? "حفظ التعديلات" : "حفظ المستخدم"}
              <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
                {USER_FORM_SHORTCUTS.save.label}
              </ShortcutBadge>
            </>
          )}
        </Button>
      </div>

      <ResetPasswordDialog
        user={resetOpen && current ? current : null}
        onClose={() => setResetOpen(false)}
      />
    </form>
  );
}
