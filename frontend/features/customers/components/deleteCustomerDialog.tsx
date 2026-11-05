"use client";

import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { useRef } from "react";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useDeleteCustomer } from "../hooks/useCustomerMutations";
import type { Customer } from "../types/customer";

/** حذف عميل: ممنوع لو عليه دين. والتركيز الافتراضي على "رجوع" (الأكثر أماناً). */
export function DeleteCustomerDialog({
  customer,
  onClose,
  onCollect,
}: {
  customer: Customer | null;
  onClose: () => void;
  onCollect: (id: string) => void;
}) {
  const remove = useDeleteCustomer();
  const backRef = useRef<HTMLButtonElement>(null);
  const blocked = (customer?.balance ?? 0) > 0;

  return (
    <Dialog
      open={customer !== null}
      onOpenChange={(next) => !next && onClose()}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={backRef}
        className="sm:max-w-sm"
      >
        <DialogHeader className="text-start">
          <DialogTitle>حذف {customer?.name}؟</DialogTitle>
          <DialogDescription className="space-y-1">
            {blocked && customer ? (
              <span className="flex items-start gap-2 text-destructive">
                <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  لا يمكن حذف عميل عليه مديونية (
                  <Money
                    amount={customer.balance}
                    className="inline-flex text-xs"
                  />
                  ). حصّل المبلغ أولاً.
                </span>
              </span>
            ) : (
              <>
                <span className="block">
                  لن يظهر العميل في الكاشير ولا في القوائم.
                </span>
                <span className="block">
                  لو تريد إيقافه مؤقتاً فقط، استخدم «تعطيل» بدل الحذف.
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {blocked && customer ? (
            <Button
              type="button"
              size="lg"
              onClick={() => onCollect(customer.id)}
            >
              تحصيل دفعة
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={remove.isPending || !customer}
              onClick={() =>
                customer &&
                remove.mutate(
                  { id: customer.id, version: customer.version },
                  { onSuccess: onClose },
                )
              }
              className="gap-2"
            >
              {remove.isPending && (
                <IconLoader2 className="size-4 animate-spin" />
              )}
              حذف العميل
            </Button>
          )}
          <Button
            ref={backRef}
            type="button"
            variant="outline"
            size="lg"
            onClick={onClose}
          >
            رجوع
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
