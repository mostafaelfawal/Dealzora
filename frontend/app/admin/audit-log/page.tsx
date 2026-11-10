import type { Metadata } from "next";

import { AuditLogScreen } from "@/features/auditLog/components/auditLogScreen";

export const metadata: Metadata = { title: "سجل العمليات" };

export default function AuditLogPage() {
  return <AuditLogScreen />;
}
