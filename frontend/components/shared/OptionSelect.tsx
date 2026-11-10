"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** قائمة اختيار بسيطة بقيم نصية ثابتة (فلاتر، ترتيب…). */
export function OptionSelect<T extends string>({
  label,
  items,
  value,
  onChange,
  className,
  disabled,
}: {
  label: string;
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      items={items as { value: T; label: string }[]}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
    >
      <SelectTrigger
        aria-label={label}
        className={cn("data-[size=default]:h-10", className)}
      >
        <SelectValue className="text-start" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
