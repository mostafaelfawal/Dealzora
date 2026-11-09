"use client";

import { IconLoader2 } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { User } from "../types/user";

/** تأكيد حذف مستخدم (الحذف ينهي جلساته فوراً). */
export function DeleteUserDialog({
  user,
  isPending,
  onConfirm,
  onClose,
}: {
  user: User | null;
  isPending: boolean;
  onConfirm: (user: User) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="gap-3 sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle>حذف مستخدم</DialogTitle>
          <DialogDescription>
            {user && (
              <>
                سيُحذف{" "}
                <bdi dir="ltr" className="font-mono">
                  {user.username}
                </bdi>{" "}
                ويُسجَّل خروجه فوراً. لو كنت تريد إيقافه مؤقتاً، عطّله بدل الحذف.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={onClose}
            className="font-normal"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={isPending}
            onClick={() => user && onConfirm(user)}
            className="gap-2 px-5"
          >
            {isPending ? (
              <>
                <IconLoader2 className="size-4 animate-spin" aria-hidden />
                جارٍ الحذف…
              </>
            ) : (
              "حذف المستخدم"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}