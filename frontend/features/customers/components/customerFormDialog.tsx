"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FieldError } from "@/components/shared/form";
import { Money } from "@/components/shared/Money";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
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
import { Switch } from "@/components/ui/switch";

import { CREDIT_LIMIT_PRESETS } from "../config/customerOptions";
import { useSaveCustomer } from "../hooks/useCustomerMutations";
import { amountOrZero, parseAmount } from "../lib/customerCalc";
import {
  customerToForm,
  EMPTY_CUSTOMER_FORM,
  formToInput,
} from "../lib/customerForm";
import {
  customerSchema,
  type CustomerSchemaType,
} from "../schema/customer.schema";
import type { Customer } from "../types/customer";
import { CurrencyLabel } from "@/components/shared/CurrencyLabel";

const IDS = {
  name: "cf-name",
  phone: "cf-phone",
  address: "cf-address",
  creditLimit: "cf-limit",
  openingBalance: "cf-opening",
  notes: "cf-notes",
} as const;

/** إضافة عميل (customer = null) أو تعديله. المحتوى يتركّب عند الفتح فقط ليبدأ الفورم نظيفاً. */
export function CustomerFormDialog({
  open,
  customer,
  onClose,
}: {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-lg"
      >
        {open && <CustomerForm customer={customer} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function CustomerForm({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const isEditing = customer !== null;
  const save = useSaveCustomer();
  const [pendingAction, setPendingAction] = useState<"save" | "saveAndNew">(
    "save",
  );

  const form = useForm<CustomerSchemaType>({
    resolver: zodResolver(customerSchema),
    mode: "onTouched",
    defaultValues: customer ? customerToForm(customer) : EMPTY_CUSTOMER_FORM,
  });
  const {
    register,
    setValue,
    handleSubmit,
    reset,
    setFocus,
    control,
    formState: { errors },
  } = form;
  const [creditLimit, isActive] = useWatch({
    control,
    name: ["creditLimit", "isActive"],
  });

  const limit = amountOrZero(parseAmount(creditLimit));
  const saving = save.isPending;

  function submit(andNew: boolean) {
    if (saving) return;
    setPendingAction(andNew ? "saveAndNew" : "save");
    void handleSubmit((values) =>
      save.mutate(
        {
          input: formToInput(values),
          id: customer?.id,
          baseVersion: customer?.version,
        },
        {
          onSuccess: () => {
            if (andNew) {
              reset(EMPTY_CUSTOMER_FORM);
              setFocus("name");
            } else onClose();
          },
        },
      ),
    )();
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
      className="space-y-4"
    >
      <DialogHeader className="text-start">
        <DialogTitle>{isEditing ? "تعديل عميل" : "عميل جديد"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "عدّل بيانات العميل أو حدّه الائتماني ثم احفظ."
            : "الاسم فقط هو المطلوب. أضف الهاتف والحد الائتماني لتبيع له بالآجل."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor={IDS.name}>اسم العميل *</Label>
        <Input
          id={IDS.name}
          {...register("name")}
          autoFocus
          autoComplete="off"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={`${IDS.name}-error`}
          disabled={saving}
          placeholder="مثال: أحمد محمود"
        />
        <FieldError id={`${IDS.name}-error`} message={errors.name?.message} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={IDS.phone}>رقم الهاتف</Label>
          <Input
            id={IDS.phone}
            {...register("phone")}
            dir="ltr"
            inputMode="tel"
            autoComplete="off"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={`${IDS.phone}-error`}
            disabled={saving}
            placeholder="01012345678"
            className="font-mono"
          />
          <FieldError
            id={`${IDS.phone}-error`}
            message={errors.phone?.message}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={IDS.address}>العنوان</Label>
          <Input
            id={IDS.address}
            {...register("address")}
            autoComplete="off"
            aria-invalid={Boolean(errors.address)}
            disabled={saving}
            placeholder="اختياري"
          />
          <FieldError
            id={`${IDS.address}-error`}
            message={errors.address?.message}
          />
        </div>
      </div>

      <section className="space-y-3 border p-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">البيع الآجل</h3>
          <p className="text-xs text-muted-foreground">
            الحد الائتماني هو أقصى دين مسموح للعميل. اتركه 0 للبيع النقدي فقط.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={IDS.creditLimit}>الحد الائتماني (<CurrencyLabel />)</Label>
          <Input
            id={IDS.creditLimit}
            {...register("creditLimit")}
            dir="ltr"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={Boolean(errors.creditLimit)}
            aria-describedby={`${IDS.creditLimit}-error`}
            disabled={saving}
            placeholder="0"
            className="font-mono"
          />
          <FieldError
            id={`${IDS.creditLimit}-error`}
            message={errors.creditLimit?.message}
          />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {CREDIT_LIMIT_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant={limit === preset ? "default" : "outline"}
                aria-pressed={limit === preset}
                disabled={saving}
                onClick={() =>
                  setValue("creditLimit", preset ? String(preset) : "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className="font-normal"
              >
                {preset === 0 ? (
                  "نقدي فقط"
                ) : (
                  <bdi dir="ltr" className="font-mono tabular-nums">
                    {preset.toLocaleString("en-US")}
                  </bdi>
                )}
              </Button>
            ))}
          </div>
          {isEditing &&
            customer.balance > 0 &&
            limit > 0 &&
            limit < customer.balance && (
              <p
                role="status"
                className="flex flex-wrap items-baseline gap-1 text-xs text-warning"
              >
                الحد أقل من دينه الحالي (
                <Money amount={customer.balance} className="text-xs" />
                ). لن يستطيع الشراء بالآجل حتى يسدد.
              </p>
            )}
        </div>

        {!isEditing && (
          <div className="space-y-1.5">
            <Label htmlFor={IDS.openingBalance}>دين سابق (رصيد افتتاحي)</Label>
            <Input
              id={IDS.openingBalance}
              {...register("openingBalance")}
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={Boolean(errors.openingBalance)}
              aria-describedby={`${IDS.openingBalance}-error`}
              disabled={saving}
              placeholder="0"
              className="font-mono"
            />
            <FieldError
              id={`${IDS.openingBalance}-error`}
              message={errors.openingBalance?.message}
            />
            <p className="text-xs text-muted-foreground">
              لو العميل عليه مبلغ من قبل، اكتبه ليظهر في كشف حسابه.
            </p>
          </div>
        )}
      </section>

      <div className="space-y-1.5">
        <Label htmlFor={IDS.notes}>ملاحظات</Label>
        <Input
          id={IDS.notes}
          {...register("notes")}
          autoComplete="off"
          aria-invalid={Boolean(errors.notes)}
          disabled={saving}
          placeholder="مثال: يدفع آخر كل شهر"
        />
        <FieldError id={`${IDS.notes}-error`} message={errors.notes?.message} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <div className="space-y-0.5">
          <Label htmlFor="cf-active">عميل نشط</Label>
          <p className="text-xs text-muted-foreground">
            العميل المعطّل لا يظهر في اختيار العملاء بالكاشير.
          </p>
        </div>
        <Switch
          id="cf-active"
          checked={isActive}
          disabled={saving}
          onCheckedChange={(checked) =>
            setValue("isActive", checked, { shouldDirty: true })
          }
        />
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={saving}
          onClick={onClose}
          className="gap-2 font-normal sm:me-auto"
        >
          إلغاء
          <ShortcutBadge className="hidden rounded-none lg:inline-flex">
            Esc
          </ShortcutBadge>
        </Button>

        {!isEditing && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={saving}
            onClick={() => submit(true)}
            className="gap-2 font-normal"
          >
            {saving && pendingAction === "saveAndNew" ? (
              <>
                <IconLoader2 className="size-4 animate-spin" aria-hidden />
                جارٍ الحفظ…
              </>
            ) : (
              "حفظ وإضافة آخر"
            )}
          </Button>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={saving}
          className="gap-2 px-5"
        >
          {saving && pendingAction === "save" ? (
            <>
              <IconLoader2 className="size-4 animate-spin" aria-hidden />
              جارٍ الحفظ…
            </>
          ) : (
            <>
              <IconDeviceFloppy className="size-4" aria-hidden />
              {isEditing ? "حفظ التعديلات" : "حفظ العميل"}
              <ShortcutBadge className="hidden rounded-none border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
                Enter
              </ShortcutBadge>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
