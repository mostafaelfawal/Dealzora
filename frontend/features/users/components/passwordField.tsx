"use client";

import {
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconRefresh,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

import { generatePassword } from "../lib/userPassword";

interface PasswordFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}

/** حقل كلمة مرور للمدير: إظهار/إخفاء + توليد كلمة قوية + نسخ (ليعطيها للكاشير). */
export function PasswordField({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  autoFocus,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const { copied, copy: copyText } = useCopyToClipboard();

  async function copy() {
    if (!value) return;
    if (await copyText(value)) toast.success("تم نسخ كلمة المرور");
    else toast.error("تعذّر النسخ");
  }

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        dir="ltr"
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="new-password"
        autoFocus={autoFocus}
        spellCheck={false}
        className="font-mono"
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        aria-pressed={show}
        onClick={() => setShow((current) => !current)}
        className="size-8 shrink-0"
      >
        {show ? <IconEyeOff /> : <IconEye />}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="نسخ كلمة المرور"
        disabled={!value}
        onClick={() => void copy()}
        className="size-8 shrink-0"
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          onChange(generatePassword());
          setShow(true);
        }}
        className="shrink-0 gap-1.5 font-normal"
      >
        <IconRefresh className="size-4" aria-hidden />
        توليد
      </Button>
    </div>
  );
}
