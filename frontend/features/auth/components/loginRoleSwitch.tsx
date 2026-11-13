import { IconCashRegister, IconUserShield } from "@tabler/icons-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";

import { LOGIN_ROLE_OPTIONS, type LoginRole } from "../config/authOptions";

const ROLE_ICONS: Record<LoginRole, ComponentType<{ className?: string }>> = {
  cashier: IconCashRegister,
  manager: IconUserShield,
};

export function LoginRoleSwitch({
  value,
  onChange,
  disabled,
}: {
  value: LoginRole;
  onChange: (role: LoginRole) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="نوع الحساب"
      className="grid grid-cols-2 gap-2"
    >
      {LOGIN_ROLE_OPTIONS.map((option) => {
        const Icon = ROLE_ICONS[option.value];
        const active = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            size="lg"
            variant={active ? "default" : "outline"}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className="gap-2 font-normal"
          >
            <Icon className="size-4" />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
