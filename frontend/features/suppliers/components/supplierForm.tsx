"use client";

import {
  IconDeviceFloppy,
  IconLoader2,
  IconPhone,
  IconReceipt,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import type { FieldErrors, Path, PathValue } from "react-hook-form";
import { toast } from "sonner";

import { Money } from "@/components/shared/Money";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useHotkey } from "@/hooks/useHotkey";
import { cn } from "@/lib/utils";

import { SUPPLIER_ROUTES } from "../config/supplierRoutes";
import { SUPPLIER_FORM_SHORTCUTS } from "../config/supplierShortcuts";
import { useSupplierFormContext } from "../context/SupplierFormContext";
import type { SupplierSchemaType } from "../schema/supplier.schema";

const FIELD_IDS = {
  name: "sf-name",
  phone: "sf-phone",
  address: "sf-address",
  notes: "sf-notes",
  openingBalance: "sf-opening",
} as const;

const ERROR_ORDER = [
  "name",
  "phone",
  "address",
  "notes",
  "openingBalance",
] as const;

function focusFirstError(errors: FieldErrors<SupplierSchemaType>) {
  for (const field of ERROR_ORDER) {
    if (!errors[field]) continue;
    document.getElementById(FIELD_IDS[field])?.focus();
    return;
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function SupplierForm() {
  const { form, supplierId, supplierData, onSubmit, isSaving } =
    useSupplierFormContext();
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
  const isEditing = Boolean(supplierId);
  const values = watch();

  function setField<P extends Path<SupplierSchemaType>>(
    name: P,
    value: PathValue<SupplierSchemaType, P>,
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

  useHotkey(SUPPLIER_FORM_SHORTCUTS.save.match, () => submit(false));
  useHotkey(SUPPLIER_FORM_SHORTCUTS.saveAndNew.match, () => submit(true));

  const invalid = (field: keyof typeof FIELD_IDS) => Boolean(errors[field]);
  const current = supplierData.data;

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
          {isEditing ? "تعديل مورد" : "مورد جديد"}
        </h1>
        <p className="text-xs text-muted-foreground">
          {isEditing
            ? "عدّل بيانات المورد ثم احفظ."
            : "اسم المورد فقط هو المطلوب."}
        </p>
      </header>

      <section className="space-y-4 border bg-card p-4">
        <h2 className="text-sm font-semibold">بيانات المورد</h2>

        <div className="space-y-1.5">
          <Label htmlFor="sf-name">اسم المورد *</Label>
          <Input
            id="sf-name"
            {...register("name")}
            aria-invalid={invalid("name")}
            aria-describedby="sf-name-error"
            autoComplete="off"
            autoFocus={!isEditing}
            placeholder="مثال: شركة النور للتوريدات"
          />
          <FieldError id="sf-name-error" message={errors.name?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sf-phone">رقم الهاتف</Label>
          <div className="relative">
            <IconPhone
              aria-hidden
              className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="sf-phone"
              dir="ltr"
              inputMode="tel"
              {...register("phone")}
              aria-invalid={invalid("phone")}
              aria-describedby="sf-phone-error"
              autoComplete="off"
              placeholder="01000000000"
              className="ps-8 font-mono"
            />
          </div>
          <FieldError id="sf-phone-error" message={errors.phone?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sf-address">العنوان</Label>
          <Input
            id="sf-address"
            {...register("address")}
            aria-invalid={invalid("address")}
            aria-describedby="sf-address-error"
            autoComplete="off"
            placeholder="المدينة، الشارع"
          />
          <FieldError id="sf-address-error" message={errors.address?.message} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sf-notes">ملاحظات</Label>
          <Textarea
            id="sf-notes"
            rows={3}
            {...register("notes")}
            aria-invalid={invalid("notes")}
            aria-describedby="sf-notes-error"
            placeholder="مواعيد التوريد، شروط السداد…"
          />
          <FieldError id="sf-notes-error" message={errors.notes?.message} />
        </div>
      </section>

      <section className="space-y-3 border bg-card p-4">
        <h2 className="text-sm font-semibold">الحساب</h2>

        {isEditing ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">المستحق له حالياً</p>
              <Money
                amount={current?.balance ?? 0}
                className="text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground">
                الرصيد يتغيّر من فواتير الشراء والدفعات، وليس من هنا.
              </p>
            </div>
            {supplierId && (
              <Button
                type="button"
                variant="outline"
                nativeButton={false}
                render={<Link href={SUPPLIER_ROUTES.statement(supplierId)} />}
                className="gap-2 font-normal"
              >
                <IconReceipt className="size-4" />
                كشف حساب
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="sf-opening">الرصيد الافتتاحي (مستحق له)</Label>
            <Input
              id="sf-opening"
              dir="ltr"
              inputMode="decimal"
              {...register("openingBalance")}
              aria-invalid={invalid("openingBalance")}
              aria-describedby="sf-opening-error"
              autoComplete="off"
              placeholder="0"
              className="font-mono"
            />
            <FieldError
              id="sf-opening-error"
              message={errors.openingBalance?.message}
            />
            <p className="text-xs text-muted-foreground">
              المبلغ الذي علينا له قبل استخدام البرنامج. اتركه فارغاً لو لا يوجد.
            </p>
          </div>
        )}
      </section>

      <section className="flex items-center justify-between gap-3 border bg-card p-4">
        <div className="space-y-0.5">
          <Label htmlFor="sf-active">مورد نشط</Label>
          <p className="text-xs text-muted-foreground">
            المورد المعطّل لا يظهر عند تسجيل فاتورة شراء جديدة.
          </p>
        </div>
        <Switch
          id="sf-active"
          checked={values.isActive}
          onCheckedChange={(checked) => setField("isActive", checked)}
        />
      </section>

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
          render={<Link href={SUPPLIER_ROUTES.list} />}
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
                  {SUPPLIER_FORM_SHORTCUTS.saveAndNew.label}
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
              {isEditing ? "حفظ التعديلات" : "حفظ المورد"}
              <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
                {SUPPLIER_FORM_SHORTCUTS.save.label}
              </ShortcutBadge>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
