"use client";

import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheckFilled,
  IconInfoCircle,
  IconLoader2,
} from "@tabler/icons-react";
import { useState } from "react";

import { PasswordInput } from "@/features/auth/components/passwordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  PASSWORD_MIN,
  SETUP_FIELD_IDS,
  TRIAL_PERKS,
} from "../config/setupOptions";
import { useSetupFormContext } from "../context/SetupFormContext";
import type { SetupStep } from "../types/setup";

/** مراحل الإعداد بالترتيب كما تمر بها runSetup. */
const PROGRESS: { step: Exclude<SetupStep, "idle">; label: string }[] = [
  { step: "trial", label: "تفعيل خطة «بَسطة» المجانية" },
  { step: "account", label: "إنشاء حساب المالك" },
  { step: "login", label: "تجهيز لوحة التحكم" },
];

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function FormSection({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4 flex w-full items-start gap-3">
        <span
          aria-hidden
          className="grid size-6 shrink-0 place-items-center bg-primary text-xs font-bold text-primary-foreground"
        >
          {index}
        </span>
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block text-xs text-muted-foreground">
            {description}
          </span>
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

function SetupProgress({ step }: { step: SetupStep }) {
  const current = PROGRESS.findIndex((p) => p.step === step);
  return (
    <ol
      role="status"
      aria-live="polite"
      className="space-y-2 border bg-muted/30 p-3"
    >
      {PROGRESS.map(({ step: s, label }, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={s}
            className={cn(
              "flex items-center gap-2 text-xs",
              !done && !active && "text-muted-foreground",
              active && "font-medium",
            )}
          >
            {done ? (
              <IconCircleCheckFilled
                className="size-4 shrink-0 text-success"
                aria-hidden
              />
            ) : active ? (
              <IconLoader2
                className="size-4 shrink-0 animate-spin text-primary"
                aria-hidden
              />
            ) : (
              <span
                aria-hidden
                className="mx-0.5 size-3 shrink-0 rounded-full border-2"
              />
            )}
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export function SetupForm() {
  const { form, submit, step, isSubmitting, errorMessage, clearError } =
    useSetupFormContext();
  const {
    register,
    formState: { errors },
  } = form;
  const [capsLock, setCapsLock] = useState(false);

  const field = (name: "shopName" | "username" | "password" | "confirm") =>
    register(name, { onChange: clearError });

  return (
    <form noValidate onSubmit={submit} className="flex w-full flex-col gap-6">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-xl font-bold">لنجهّز محلك في دقيقة 👋</h1>
          <p className="text-sm text-muted-foreground">
            أنشئ حساب المالك وابدأ البيع فوراً، بدون بطاقة بنكية.
          </p>
        </div>

        <ul className="space-y-1.5 border-s-2 border-success ps-3">
          {TRIAL_PERKS.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-xs">
              <IconCheck
                className="mt-px size-3.5 shrink-0 text-success"
                aria-hidden
              />
              {perk}
            </li>
          ))}
        </ul>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 border border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive"
        >
          <IconAlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      <FormSection
        index={1}
        title="بيانات المحل"
        description="يظهر الاسم على الفواتير والتقارير، ويمكنك تعديله لاحقاً."
      >
        <Field
          id={SETUP_FIELD_IDS.shopName}
          label="اسم المحل"
          error={errors.shopName?.message}
        >
          <Input
            id={SETUP_FIELD_IDS.shopName}
            {...field("shopName")}
            autoFocus
            autoComplete="organization"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.shopName)}
            aria-describedby={`${SETUP_FIELD_IDS.shopName}-error`}
            placeholder="مثال: سوبر ماركت النور"
            className="h-10"
          />
        </Field>
      </FormSection>

      <FormSection
        index={2}
        title="حساب المالك"
        description="كل الصلاحيات، ومنه تضيف مدير الفرع والكاشيرية لاحقاً."
      >
        <Field
          id={SETUP_FIELD_IDS.username}
          label="اسم المستخدم"
          hint="حروف إنجليزية صغيرة وأرقام، ستستخدمه عند كل دخول."
          error={errors.username?.message}
        >
          <Input
            id={SETUP_FIELD_IDS.username}
            {...field("username")}
            dir="ltr"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.username)}
            aria-describedby={
              errors.username
                ? `${SETUP_FIELD_IDS.username}-error`
                : `${SETUP_FIELD_IDS.username}-hint`
            }
            placeholder="owner"
            className="h-10 font-mono"
          />
        </Field>

        <Field
          id={SETUP_FIELD_IDS.password}
          label="كلمة المرور"
          hint={`${PASSWORD_MIN} خانات على الأقل، أرقام أو حروف. اختر شيئاً تتذكره بسهولة.`}
          error={errors.password?.message}
        >
          <PasswordInput
            id={SETUP_FIELD_IDS.password}
            {...register("password", {
              onChange: clearError,
              onBlur: () => setCapsLock(false),
            })}
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password
                ? `${SETUP_FIELD_IDS.password}-error`
                : `${SETUP_FIELD_IDS.password}-hint`
            }
            onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
          />
          {capsLock && (
            <p
              role="status"
              className="flex items-center gap-1.5 text-xs text-warning"
            >
              <IconAlertTriangle className="size-3.5" aria-hidden />
              زر Caps Lock مفعّل
            </p>
          )}
        </Field>

        <Field
          id={SETUP_FIELD_IDS.confirm}
          label="تأكيد كلمة المرور"
          error={errors.confirm?.message}
        >
          <PasswordInput
            id={SETUP_FIELD_IDS.confirm}
            {...field("confirm")}
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.confirm)}
            aria-describedby={`${SETUP_FIELD_IDS.confirm}-error`}
          />
        </Field>

        <p className="flex items-start gap-2 border border-warning/40 bg-warning/5 p-2.5 text-xs">
          <IconInfoCircle
            className="mt-px size-4 shrink-0 text-warning"
            aria-hidden
          />
          <span>
            احفظ كلمة المرور في مكان آمن، فهي مفتاح حساب المالك ولا يمكن
            استرجاعها لو نُسيت.
          </span>
        </p>
      </FormSection>

      <div className="space-y-3">
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="h-11 w-full gap-2 text-sm"
        >
          {isSubmitting && <IconLoader2 className="size-4 animate-spin" />}
          {isSubmitting ? "جارٍ تجهيز محلك…" : "أنشئ المحل وابدأ مجاناً"}
        </Button>

        {isSubmitting && step !== "idle" && <SetupProgress step={step} />}
      </div>
    </form>
  );
}
