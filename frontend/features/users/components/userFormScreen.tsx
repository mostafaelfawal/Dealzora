"use client";

import { IconUsers } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { extractErrorMessage } from "@/lib/errors";

import { USER_ROUTES } from "../config/userRoutes";
import { useUserFormContext } from "../context/UserFormContext";
import { UserForm } from "./userForm";

export function UserFormScreen() {
  const { userId, userData } = useUserFormContext();
  const { data: user, isPending, isError, error } = userData;

  if (!userId) return <UserForm />;

  if (isPending) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground">
        جارٍ تحميل المستخدم…
      </p>
    );
  }

  if (isError || !user) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-24 text-center">
        <IconUsers className="size-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">لم نجد هذا المستخدم</p>
          <p className="text-xs text-muted-foreground">
            {extractErrorMessage(error, "ربما حُذف أو الرابط غير صحيح.")}
          </p>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={USER_ROUTES.list} />}
        >
          رجوع إلى المستخدمين
        </Button>
      </div>
    );
  }

  return <UserForm />;
}