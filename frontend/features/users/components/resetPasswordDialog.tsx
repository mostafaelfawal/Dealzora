"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import useResetUserPassword from "../hooks/useResetUserPassword";
import { passwordError } from "../schema/user.schema";
import type { User } from "../types/user";
import { PasswordField } from "./passwordField";

/** تحديد كلمة مرور جديدة لمستخدم. تُركَّب عند الفتح فقط ليبدأ كل مرة بحقل فارغ. */
export function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
        {user && <ResetForm user={user} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function ResetForm({ user, onClose }: { user: User; onClose: () => void }) {
  const mutation = useResetUserPassword();
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState(false);

  const error = touched ? passwordError(password, user.username) : null;
  const saving = mutation.isPending;

  async function submit() {
    setTouched(true);
    if (saving || passwordError(password, user.username)) return;
    try {
      await mutation.mutateAsync({
        userId: user.id,
        username: user.username,
        password,
      });
      onClose();
    } catch {
      // تم عرض الخطأ في onError.
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-3"
    >
      <DialogHeader className="text-start">
        <DialogTitle>تغيير كلمة المرور</DialogTitle>
        <DialogDescription>
          <bdi dir="ltr" className="font-mono">
            {user.username}
          </bdi>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="rp-password">كلمة المرور الجديدة *</Label>
        <PasswordField
          id="rp-password"
          value={password}
          onChange={setPassword}
          invalid={Boolean(error)}
          describedBy="rp-password-error"
          autoFocus
        />
        {error && (
          <p
            id="rp-password-error"
            role="alert"
            className="text-xs text-destructive"
          >
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          سيُسجَّل خروج هذا المستخدم من كل أجهزته، ويدخل بالكلمة الجديدة.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={saving}
          onClick={onClose}
          className="font-normal"
        >
          إلغاء
        </Button>
        <Button type="submit" size="lg" disabled={saving} className="gap-2 px-5">
          {saving ? (
            <>
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
              جارٍ الحفظ…
            </>
          ) : (
            "حفظ كلمة المرور"
          )}
        </Button>
      </div>
    </form>
  );
}