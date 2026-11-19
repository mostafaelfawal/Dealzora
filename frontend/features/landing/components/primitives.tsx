import type { ComponentProps, ReactNode } from "react";
import type { SimpleIcon } from "simple-icons";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Stagger, StaggerItem } from "./motion";

/** عرض المحتوى الموحّد للصفحة: 16px على الهاتف ويتسع تدريجياً. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}

/** قسم بخط فاصل علوي (نفس منطق «السجل» في البرنامج: حدود رفيعة بدل الظلال). */
export function Section({
  id,
  className,
  children,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      id={id}
      className={cn("border-t py-20 sm:py-24 lg:py-28", className)}
      {...props}
    >
      {children}
    </section>
  );
}

/** رأس القسم: رقم ترتيبي صغير + عنوان + سطر شرح. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  lead,
  id,
  align = "start",
  className,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  /** معرّف العنوان لربطه بـ aria-labelledby. */
  id?: string;
  align?: "start" | "center";
  className?: string;
}) {
  // العنوان يتتابع عند الوصول إليه: السطر الصغير، ثم العنوان بتلاشي الضبابية، ثم الشرح.
  return (
    <Stagger
      as="header"
      stagger={0.12}
      amount={0.5}
      className={cn(
        "max-w-2xl space-y-4",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <StaggerItem
        as="p"
        variant="fade"
        className={cn(
          "flex items-center gap-3 text-sm font-medium text-muted-foreground",
          align === "center" && "justify-center",
        )}
      >
        <span className="font-mono text-xs text-foreground" dir="ltr">
          {index}
        </span>
        <StaggerItem
          as="span"
          variant="line"
          aria-hidden
          className="h-px w-8 origin-right bg-border"
        />
        {eyebrow}
      </StaggerItem>
      <StaggerItem
        as="h2"
        variant="blur"
        id={id}
        className="text-3xl leading-[1.35] font-bold text-balance sm:text-4xl"
      >
        {title}
      </StaggerItem>
      {lead && (
        <StaggerItem
          as="p"
          className="text-base leading-8 text-pretty text-muted-foreground sm:text-lg"
        >
          {lead}
        </StaggerItem>
      )}
    </Stagger>
  );
}

type CtaSize = "md" | "lg";

/** أزرار الصفحة: نفس متغيرات Button في البرنامج مع ارتفاع ولمس مريح للزائر. */
export function ctaClass(
  variant: "default" | "outline" | "ghost" | "secondary" = "default",
  size: CtaSize = "md",
) {
  return cn(
    buttonVariants({ variant }),
    // الزر المحدد في البرنامج شفاف في الوضع الداكن؛ هنا نجعله صلباً حتى لا تظهر الشبكة وتوهجها من خلفه.
    variant === "outline" && "dark:bg-background dark:hover:bg-muted",
    "gap-2 text-sm font-semibold [&_svg:not([class*='size-'])]:size-[18px]",
    size === "md" ? "h-10 px-4" : "h-12 px-6 text-base",
  );
}

/** أيقونة علامة تجارية من simple-icons بلون النص الحالي. */
export function BrandIcon({
  icon,
  className,
}: {
  icon: SimpleIcon;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn("size-5 shrink-0", className)}
    >
      <path d={icon.path} />
    </svg>
  );
}

/** روابط خارجية: تبويب جديد بلا تسريب للصفحة المصدر. */
export const external = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;
