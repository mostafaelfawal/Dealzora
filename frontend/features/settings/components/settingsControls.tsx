"use client";

import { IconCircleCheckFilled } from "@tabler/icons-react";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * عناصر موحّدة لصفحات الإعدادات: نفس الشكل في كل مكان حتى لا يتوه التاجر.
 *  - ChoiceCards: اختيار واحد من بطاقات كبيرة بأيقونة ووصف (بدل قائمة منسدلة).
 *  - SettingRow:  سطر «عنوان + شرح» وعلى الطرف الآخر المفتاح أو الحقل.
 *  - SettingGroup: عنوان صغير يجمع عدة سطور.
 */

export function ChoiceCards<T extends string>({
  label,
  value,
  onChange,
  items,
  className,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: {
    value: T;
    title: string;
    description: string;
    icon: ReactNode;
    badge?: string;
  }[];
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-3 sm:grid-cols-2", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative flex items-start gap-3 border p-4 text-start transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "bg-card hover:border-primary/40 hover:bg-muted/40",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-11 shrink-0 items-center justify-center [&_svg]:size-6",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {item.icon}
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {item.title}
                {item.badge && (
                  <span className="bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="block text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </span>
            </span>
            <IconCircleCheckFilled
              aria-hidden
              className={cn(
                "size-5 shrink-0 text-primary transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function SettingRow({
  id,
  title,
  description,
  children,
  className,
}: {
  /** للربط بين العنوان والمفتاح (قارئ الشاشة + الضغط على العنوان). */
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3",
        className,
      )}
    >
      <div className="min-w-48 flex-1 space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SwitchRow({
  id,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow id={id} title={title} description={description}>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </SettingRow>
  );
}

export function SettingGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-1", className)}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y">{children}</div>
    </section>
  );
}
