"use client";

import { useMemo } from "react";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { PeriodPicker } from "@/components/shared/PeriodPicker";

import { ACTION_OPTIONS, ALL, ENTITY_OPTIONS } from "../config/auditLogOptions";
import {
  useAuditActors,
  useAuditLog,
  type AuditLogState,
} from "../hooks/useAuditLog";
import { AuditLogTable } from "./auditLogTable";

function AuditLogToolbar({ state: s }: { state: AuditLogState }) {
  const actors = useAuditActors();
  const actorOptions = useMemo(
    () => [
      { value: ALL, label: "كل المستخدمين" },
      ...(actors.data ?? []).map((a) => ({ value: a.id, label: a.name })),
    ],
    [actors.data],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PeriodPicker value={s.period} onChange={s.setPeriod} />
      <OptionSelect
        label="النوع"
        items={ENTITY_OPTIONS}
        value={s.entity}
        onChange={s.setEntity}
        className="w-40"
      />
      <OptionSelect
        label="العملية"
        items={ACTION_OPTIONS}
        value={s.action}
        onChange={s.setAction}
        className="w-40"
      />
      <OptionSelect
        label="المستخدم"
        items={actorOptions}
        value={s.actor}
        onChange={s.setActor}
        className="w-40"
      />
    </div>
  );
}

/** سجل العمليات: من فعل ماذا ومتى، بالتغييرات قبل وبعد. لا يمكن تعديله أو حذفه. */
export function AuditLogScreen() {
  const state = useAuditLog();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="سجل العمليات"
        description="كل إضافة وتعديل وحذف في النظام مسجّلة باسم من قام بها ووقتها. اضغط على أي عملية لرؤية التغييرات."
      />
      <AuditLogToolbar state={state} />
      <AuditLogTable state={state} />
    </div>
  );
}
