"use client";

import { IconKey, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { PASSWORD_MIN } from "../config/settingsOptions";
import { useChangePassword } from "../hooks/useSettings";

const EMPTY = { current: "", next: "", confirm: "" };

function PasswordField({
  id,
  label,
  value,
  autoComplete,
  invalid,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  autoComplete: string;
  invalid?: boolean;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        value={value}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function PasswordSection() {
  const change = useChangePassword();
  const [form, setForm] = useState(EMPTY);
  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mismatch = form.confirm !== "" && form.confirm !== form.next;
  const tooShort = form.next !== "" && form.next.length < PASSWORD_MIN;
  const valid =
    form.current !== "" &&
    form.next.length >= PASSWORD_MIN &&
    form.next === form.confirm;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        change.mutate(
          { current: form.current, next: form.next },
          { onSuccess: () => setForm(EMPTY) },
        );
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      <PasswordField
        id="pw-current"
        label="كلمة المرور الحالية"
        autoComplete="current-password"
        value={form.current}
        onChange={set("current")}
      />
      <PasswordField
        id="pw-next"
        label={`الجديدة (${PASSWORD_MIN} أحرف على الأقل)`}
        autoComplete="new-password"
        value={form.next}
        invalid={tooShort}
        onChange={set("next")}
      />
      <PasswordField
        id="pw-confirm"
        label="تأكيد الجديدة"
        autoComplete="new-password"
        value={form.confirm}
        invalid={mismatch}
        onChange={set("confirm")}
        error={mismatch ? "غير متطابقة" : undefined}
      />
      <div className="sm:col-span-3">
        <Button
          type="submit"
          size="lg"
          disabled={!valid || change.isPending}
          className="gap-2"
        >
          {change.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconKey className="size-4" />
          )}
          تغيير كلمة المرور
        </Button>
      </div>
    </form>
  );
}
