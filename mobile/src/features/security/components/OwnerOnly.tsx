import type { PropsWithChildren } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Screen } from "@/components/shared/Screen";

import { useIsOwner } from "../hooks/useSecurity";

/** حماية إضافية في الواجهة (الخادم يفرضها أصلاً): غير المالك لا يرى محتوى الشاشة. */
export function OwnerOnly({ children }: PropsWithChildren) {
  if (useIsOwner()) return <>{children}</>;
  return (
    <Screen>
      <EmptyState
        icon="lock-closed-outline"
        title="لمالك المحل فقط"
        description="هذه الإعدادات تظهر لحساب المالك."
      />
    </Screen>
  );
}
