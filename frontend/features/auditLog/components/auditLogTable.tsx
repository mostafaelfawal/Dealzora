"use client";

import { IconChevronDown, IconHistory } from "@tabler/icons-react";
import { useState } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { Badge } from "@/components/ui/badge";
import { formatWhen } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import {
  ACTION_LABEL,
  AUDIT_PAGE_SIZES,
  DANGER_ACTIONS,
  ENTITY_LABEL,
} from "../config/auditLogOptions";
import type { AuditLogState } from "../hooks/useAuditLog";
import type { AuditEntry } from "../types/auditLog";
import { AuditChanges } from "./auditChanges";

function buildColumns(expanded: string | null): AppTableColumn<AuditEntry>[] {
  return [
    {
      id: "what",
      header: "العملية",
      skeletonClassName: "w-48",
      cell: (e) => {
        const open = expanded === e.id;
        return (
          <div className="min-w-0 space-y-1.5">
            <p className="flex flex-wrap items-center gap-1.5 text-xs">
              <Badge
                variant="outline"
                className={cn(
                  "font-normal",
                  DANGER_ACTIONS.has(e.action) &&
                    "border-destructive/50 text-destructive",
                )}
              >
                {ACTION_LABEL[e.action] ?? e.action}
              </Badge>
              <span>{ENTITY_LABEL[e.entity] ?? e.entity}</span>
              <IconChevronDown
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform",
                  open && "rotate-180",
                )}
              />
            </p>
            {open && <AuditChanges changes={e.changes} />}
          </div>
        );
      },
    },
    {
      id: "by",
      header: "بواسطة",
      cellClassName: "text-xs",
      cell: (e) => e.actorName ?? "—",
    },
    {
      id: "when",
      header: "الوقت",
      className: "hidden sm:table-cell",
      cellClassName: "text-xs text-muted-foreground",
      cell: (e) => formatWhen(e.createdAt),
    },
  ];
}

/** جدول السجل. الضغط على صف يفتح/يغلق تفاصيل التغييرات. */
export function AuditLogTable({ state: s }: { state: AuditLogState }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { list } = s;

  return (
    <AppTable
      data={list.data?.items ?? []}
      columns={buildColumns(expanded)}
      getRowId={(e) => e.id}
      onRowClick={(e) => setExpanded((cur) => (cur === e.id ? null : e.id))}
      isLoading={list.isPending}
      isFetching={list.isFetching}
      isError={list.isError}
      errorMessage={extractErrorMessage(list.error, "تعذّر تحميل السجل")}
      onRetry={() => list.refetch()}
      isFiltered={s.isFiltered}
      onClearFilters={s.clearFilters}
      empty={{ icon: IconHistory, title: "لا توجد عمليات في هذه الفترة" }}
      pagination={{
        total: list.data?.total ?? 0,
        page: s.page,
        pageSize: s.pageSize,
        onPageChange: s.setPage,
        onPageSizeChange: s.setPageSize,
        pageSizes: AUDIT_PAGE_SIZES,
        itemsLabel: "العمليات",
      }}
    />
  );
}
