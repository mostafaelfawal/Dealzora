"use client";

import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { type ComponentProps, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AppTooltip } from "@/components/shared/AppTooltip";

export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        dir="ltr"
        className={cn("h-10 pr-10 font-mono", className)}
      />
      <AppTooltip message={visible ? "إخفاء" : "عرض"}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          tabIndex={-1}
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-1 size-8 text-muted-foreground"
        >
          {visible ? <IconEyeOff /> : <IconEye />}
        </Button>
      </AppTooltip>
    </div>
  );
}
