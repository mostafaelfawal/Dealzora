"use client";

import { IconAlertTriangle, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import { PasswordInput } from "@/features/auth/components/passwordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  SETUP_FIELD_IDS,
  TRIAL_DAYS,
  TRIAL_PERKS,
} from "../config/setupOptions";
import { useSetupFormContext } from "../context/SetupFormContext";
import type { SetupStep } from "../types/setup";
import { PasswordStrength } from "./passwordStrength";

const STEP_LABEL: Record<SetupStep, string> = {
  idle: `ابدأ التجربة المجانية (${TRIAL_DAYS} أيام)`,
  trial: "جارٍ تفعيل التجربة…",
  account: "جارٍ إنشاء حسابك…",
  login: "جارٍ تجهيز لوحة التحكم…",
};

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
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function SetupForm() {
  const { form, submit, step, isSubmitting, errorMessage, clearError } =
    useSetupFormContext();
  const {
    register,
    watch,
    formState: { errors },
  } = form;
  const [capsLock, setCapsLock] = useState(false);

  const password = watch("password");
  const field = (name: "shopName" | "username" | "password" | "confirm") =>
    register(name, { onChange: clearError });

  return (
    <form noValidate onSubmit={submit} className="flex w-full flex-col gap-4">
      <header className="space-y-1">
        <h1 className="text-lg font-bold">مرحباً بك 👋 لنجهّز محلك</h1>
        <p className="text-xs text-muted-foreground">
          دقيقة واحدة وتبدأ البيع. هذه بيانات حساب المدير الأول.
        </p>
      </header>

      <ul className="space-y-1.5 border bg-muted/40 p-3">
        {TRIAL_PERKS.map((perk) => (
          <li key={perk} className="flex items-center gap-2 text-xs">
            <IconCheck className="size-3.5 shrink-0 text-success" aria-hidden />
            {perk}
          </li>
        ))}
      </ul>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 border border-destructive/50 bg-destructive/5 p-2.5 text-xs text-destructive"
        >
          <IconAlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

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

      <Field
        id={SETUP_FIELD_IDS.username}
        label="اسم مستخدم المدير"
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
          aria-describedby={`${SETUP_FIELD_IDS.username}-error`}
          placeholder="manager"
          className="h-10 font-mono"
        />
      </Field>

      <Field
        id={SETUP_FIELD_IDS.password}
        label="كلمة المرور"
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
          aria-describedby={`${SETUP_FIELD_IDS.password}-error`}
          onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
        />
        <PasswordStrength password={password} />
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

      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="h-10 w-full gap-2"
      >
        {isSubmitting && <IconLoader2 className="size-4 animate-spin" />}
        {STEP_LABEL[step]}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        احتفظ بكلمة المرور في مكان آمن، فهي حساب المدير الوحيد ولا يمكن
        استرجاعها بدونه.
      </p>
    </form>
  );
}
