import type { Metadata } from "next";

import { AuditLogScreen } from "@/features/auditLog/components/auditLogScreen";
import { PlanGate } from "@/components/shared/PlanGate";

export const metadata: Metadata = { title: "سجل العمليات" };

export default function AuditLogPage() {
  return (
    <PlanGate feature="audit_log">
      <AuditLogScreen />
    </PlanGate>
  );
}
