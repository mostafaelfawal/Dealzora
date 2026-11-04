"use client";

import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractErrorMessage } from "@/lib/errors";

import { LOGIN_ROLE_COPY } from "../config/authOptions";
import {
  LOGIN_FIELD_IDS,
  useLoginFormContext,
} from "../context/LoginFormContext";
import { LoginRoleSwitch } from "./loginRoleSwitch";
import { PasswordInput } from "./passwordInput";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function LoginForm() {
  const { form, submit, isLoggingIn, loginError, clearError } =
    useLoginFormContext();
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const [capsLock, setCapsLock] = useState(false);

  const role = watch("role");
  const copy = LOGIN_ROLE_COPY[role];
  const serverMessage = loginError
    ? extractErrorMessage(loginError, "تعذّر تسجيل الدخول. حاول مرة أخرى.")
    : null;

  return (
    <form
      noValidate
      onSubmit={submit}
      className="flex w-full flex-col gap-4 border bg-card p-5"
    >
      <LoginRoleSwitch
        value={role}
        disabled={isLoggingIn}
        onChange={(next) => {
          setValue("role", next, { shouldDirty: true });
          clearError();
        }}
      />

      <header className="space-y-1">
        <h1 className="text-lg font-bold">{copy.title}</h1>
        <p className="text-xs text-muted-foreground">{copy.description}</p>
      </header>

      {serverMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 border border-destructive/50 bg-destructive/5 p-2.5 text-xs text-destructive"
        >
          <IconAlertTriangle className="mt-px size-4 shrink-0" aria-hidden />
          <span>{serverMessage}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={LOGIN_FIELD_IDS.username}>اسم المستخدم</Label>
        <Input
          id={LOGIN_FIELD_IDS.username}
          {...register("username", { onChange: clearError })}
          dir="ltr"
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={isLoggingIn}
          aria-invalid={Boolean(errors.username)}
          aria-describedby="login-username-error"
          placeholder="username"
          className="h-10 font-mono"
        />
        <FieldError
          id="login-username-error"
          message={errors.username?.message}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={LOGIN_FIELD_IDS.password}>كلمة المرور</Label>
        <PasswordInput
          id={LOGIN_FIELD_IDS.password}
          {...register("password", {
            onChange: clearError,
            onBlur: () => setCapsLock(false),
          })}
          autoComplete="current-password"
          disabled={isLoggingIn}
          aria-invalid={Boolean(errors.password)}
          aria-describedby="login-password-error login-caps-lock"
          onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
        />
        <FieldError
          id="login-password-error"
          message={errors.password?.message}
        />
        {capsLock && (
          <p
            id="login-caps-lock"
            role="status"
            className="flex items-center gap-1.5 text-xs text-warning"
          >
            <IconAlertTriangle className="size-3.5" aria-hidden />
            زر Caps Lock مفعّل
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={isLoggingIn}
        className="h-10 w-full gap-2"
      >
        {isLoggingIn ? (
          <>
            <IconLoader2 className="size-4 animate-spin" />
            جارٍ الدخول…
          </>
        ) : (
          copy.submitLabel
        )}
      </Button>

      {role === "cashier" ? (
        <p className="text-center text-xs text-muted-foreground">
          نسيت كلمة المرور؟ اطلب من المدير إعادة تعيينها.
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          حساب المدير له صلاحيات كاملة، لا تشارك بياناته مع أحد.
        </p>
      )}
    </form>
  );
}
