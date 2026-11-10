"use client";

import { ROLE_PERMISSIONS } from "@/config/roles";
import { useCreateBackup } from "@/features/settings/hooks/useSettings";
import { useShellData } from "@/hooks/useShellData";
import { cn } from "@/lib/utils";

import { DrawerBalance } from "./DrawerBalance";
import { ShiftStatus } from "./ShiftStatus";
import { SubscriptionBadge } from "./SubscriptionBadge";
import { SyncStatus } from "./SyncStatus";

interface HeaderStatusProps {
  /** true = النصوص كلها ظاهرة (شريط الموبايل). false = النصوص بتظهر حسب عرض الشاشة. */
  showLabels?: boolean;
  className?: string;
}

export function HeaderStatus({
  showLabels = false,
  className,
}: HeaderStatusProps) {
  const { user, shift, drawerBalance, sync, subscription } = useShellData();
  const canViewDrawerBalance = ROLE_PERMISSIONS[user.role].canViewDrawerBalance;
  const backup = useCreateBackup();
  const isManager = user.role === "manager";

  return (
    <div className={cn("items-center gap-1", className)}>
      <SubscriptionBadge subscription={subscription} />
      <ShiftStatus shift={shift} showLabels={showLabels} />
      {canViewDrawerBalance && shift && (
        <DrawerBalance amount={drawerBalance} showLabels={showLabels} />
      )}
      <SyncStatus
        sync={backup.isPending ? { ...sync, status: "syncing" } : sync}
        showLabels={showLabels}
        onBackup={isManager ? () => backup.mutate() : undefined}
      />
    </div>
  );
}
