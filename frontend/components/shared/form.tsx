"use client";

import { IconChevronDown, IconLoader2 } from "@tabler/icons-react";
import { useId, useState, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * لبنات النماذج المشتركة: نفس الشكل ونفس سلوك الوصولية في كل شاشات التطبيق.
 * الأخطاء مربوطة بالحقل عبر aria-describedby = `${id}-error`.
 */

export const errorId = (fieldId: string) => `${fieldId}-error`;

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

/** عنوان + الحقل + رسالة الخطأ. الحقل نفسه يُمرَّر كـ children ويستخدم نفس id. */
export function FormField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      <FieldError id={errorId(id)} message={error} />
    </div>
  );
}

/** بطاقة قسم داخل نموذج: عنوان اختياري + وصف + إجراء على الطرف. */
export function FormSection({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const hasHeader = title || description || action;
  return (
    <section className={cn("space-y-4 border bg-card p-4", className)}>
      {hasHeader && (
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** مفتاح تشغيل/إيقاف بعنوان وشرح. */
export function SwitchField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

/** محتوى زر الحفظ أثناء الإرسال. */
export function SavingLabel({ text = "جارٍ الحفظ…" }: { text?: string }) {
  return (
    <>
      <IconLoader2 className="size-4 animate-spin" aria-hidden />
      {text}
    </>
  );
}

/**
 * قسم قابل للطي للخيارات الإضافية (يقلل الزحمة على التاجر):
 * مطوي بملخص قصير، ويفتح تلقائياً لو فيه قيم (defaultOpen) أو أخطاء (forceOpen).
 */
export function CollapsibleSection({
  title,
  summary,
  icon,
  defaultOpen = false,
  forceOpen = false,
  action,
  className,
  children,
}: {
  title: ReactNode;
  /** سطر يظهر تحت العنوان (مثلاً «كرتونة (12)» أو «غير مستخدم»). */
  summary?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = open || forceOpen;
  const panelId = useId();
  return (
    <section className={cn("border bg-card", className)}>
      <div className="flex items-center gap-2 p-4">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setOpen(!expanded)}
          className="flex min-w-0 flex-1 items-center gap-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {icon && (
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center bg-muted text-muted-foreground [&_svg]:size-4"
            >
              {icon}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{title}</span>
            {summary && (
              <span className="block truncate text-xs text-muted-foreground">
                {summary}
              </span>
            )}
          </span>
          <IconChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        {action}
      </div>
      {expanded && (
        <div id={panelId} className="space-y-4 border-t p-4">
          {children}
        </div>
      )}
    </section>
  );
}
