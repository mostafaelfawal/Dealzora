import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { periodOf, type PeriodValue } from "@/components/shared/PeriodPicker";

import {
  fetchAuditActors,
  fetchAuditFilters,
  fetchAuditLog,
} from "../api/auditLog.api";
import { ALL, AUDIT_DEFAULT_PAGE_SIZE } from "../config/auditLogOptions";

export const auditKeys = {
  all: ["audit"] as const,
  actors: () => [...auditKeys.all, "actors"] as const,
  filters: () => [...auditKeys.all, "filters"] as const,
  list: (f: object) => [...auditKeys.all, "list", f] as const,
};

export function useAuditActors() {
  return useQuery({ queryKey: auditKeys.actors(), queryFn: fetchAuditActors });
}

/** قوائم «النوع» و«العملية» من الـ backend (الموجود فعلاً في السجل وبأسمائه العربية). */
export function useAuditFilterOptions() {
  return useQuery({
    queryKey: auditKeys.filters(),
    queryFn: fetchAuditFilters,
    staleTime: 5 * 60_000,
  });
}

/** فلاتر السجل + القائمة. أي تغيير في فلتر يرجع للصفحة الأولى. */
export function useAuditLog() {
  const [entity, setEntity] = useState(ALL);
  const [action, setAction] = useState(ALL);
  const [actor, setActor] = useState(ALL);
  const [period, setPeriod] = useState<PeriodValue>(periodOf("week"));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(AUDIT_DEFAULT_PAGE_SIZE);

  const filters = {
    entity,
    action,
    actor,
    from: period.range.from,
    to: period.range.to,
    page,
    pageSize,
  };
  const list = useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => fetchAuditLog(filters),
    placeholderData: keepPreviousData,
  });

  const withPageReset =
    <T>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  return {
    entity,
    setEntity: withPageReset(setEntity),
    action,
    setAction: withPageReset(setAction),
    actor,
    setActor: withPageReset(setActor),
    period,
    setPeriod: withPageReset(setPeriod),
    page,
    setPage,
    pageSize,
    setPageSize: withPageReset(setPageSize),
    isFiltered: entity !== ALL || action !== ALL || actor !== ALL,
    clearFilters: () => {
      setEntity(ALL);
      setAction(ALL);
      setActor(ALL);
    },
    list,
  };
}

export type AuditLogState = ReturnType<typeof useAuditLog>;
