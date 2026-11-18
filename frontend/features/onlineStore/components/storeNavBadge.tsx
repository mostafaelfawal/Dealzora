"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useBranchStatus } from "@/features/branchTransfers/hooks/useBranchTransfers";
import { useSessionUser } from "@/hooks/useShellData";
import { useFeature } from "@/lib/plan";
import { cn } from "@/lib/utils";

import { useStoreSummary } from "../hooks/useOnlineStore";

/** عدد الطلبات الجديدة بجانب «المتجر الإلكتروني»، وتنبيه عند وصول طلب جديد أثناء العمل. */
export function StoreNavBadge({ collapsed }: { collapsed: boolean }) {
  const owner = useSessionUser().role === "owner";
  const feature = useFeature("online_store");
  const status = useBranchStatus();
  const enabled =
    owner &&
    feature &&
    status.data?.connected === true &&
    status.data?.isAdmin === true;
  const count = useStoreSummary(enabled).data?.counts.new ?? 0;
  const last = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    if (last.current !== null && count > last.current) {
      const added = count - last.current;
      toast.info(
        added === 1
          ? "طلب جديد من المتجر الإلكتروني"
          : `${added} طلبات جديدة من المتجر الإلكتروني`,
        {
          description: "افتح المتجر الإلكتروني لتأكيده.",
          action: {
            label: "عرض",
            onClick: () => router.push("/admin/store?tab=orders"),
          },
        },
      );
    }
    last.current = count;
  }, [count, enabled, router]);

  if (!enabled || count <= 0) return null;
  const label = count === 1 ? "طلب جديد" : `${count} طلبات جديدة`;
  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "flex min-w-5 items-center justify-center bg-primary px-1 font-mono text-[11px] leading-5 text-primary-foreground tabular-nums",
        collapsed
          ? "absolute top-1 inset-e-1 min-w-4 text-[10px] leading-4"
          : "ms-auto",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
