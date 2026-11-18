import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

/** نفس أزرار البرنامج: زوايا حادة، أحادي اللون، وتأثير ضغط خفيف. */
const VARIANTS = {
  default: "bg-primary text-primary-foreground hover:bg-primary/85",
  outline:
    "border border-border bg-background hover:bg-muted hover:text-foreground",
  ghost: "hover:bg-muted",
  destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-base",
  icon: "size-10",
  "icon-sm": "size-8",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export const buttonClass = (
  variant: ButtonVariant = "default",
  size: ButtonSize = "md",
  className?: string,
) =>
  cn(
    "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap outline-none select-none transition-[background-color,color,transform,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

const field =
  "w-full border border-input bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:opacity-50";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(field, "min-h-20 py-2.5", className)} {...props} />
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted", className)} />;
}
