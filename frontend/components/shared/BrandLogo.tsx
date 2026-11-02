import Image from "next/image";

import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** `icon` للشعار المصغّر، `full` للشعار الكامل مع الاسم. */
  variant: "icon" | "full";
  className?: string;
}

/** يعرض نسخة الوضع الفاتح أو الداكن حسب الثيم بدون وميض. */
export function BrandLogo({ variant, className }: BrandLogoProps) {
  const { light, dark, width, height } = BRAND.logo[variant];

  return (
    <>
      <Image
        src={light}
        alt={BRAND.name}
        width={width}
        height={height}
        priority
        className={cn("h-8 w-auto dark:hidden", className)}
      />
      <Image
        src={dark}
        alt={BRAND.name}
        width={width}
        height={height}
        priority
        className={cn(
          "hidden h-8 w-auto dark:block bg-foreground rounded-sm border",
          className,
        )}
      />
    </>
  );
}
