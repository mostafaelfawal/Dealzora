import { IconBuildingStore } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

export function StoreLogo({
  url,
  name,
  className,
}: {
  url: string | null;
  name: string;
  className?: string;
}) {
  if (url)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- صور السيرفر نفسه بأحجام مضغوطة مسبقاً
      <img
        src={url}
        alt={`شعار ${name}`}
        className={cn("shrink-0 border object-cover", className)}
      />
    );
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary text-primary-foreground",
        className,
      )}
    >
      <IconBuildingStore className="size-1/2" />
    </span>
  );
}
