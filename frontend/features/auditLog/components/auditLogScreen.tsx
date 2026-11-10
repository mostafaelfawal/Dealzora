"use client";

import { IconChevronDown, IconHistory } from "@tabler/icons-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import { PeriodPicker, periodOf, type PeriodValue } from "@/components/shared/PeriodPicker";
import { Badge } from "@/components/ui/badge";
import { cleanParams, toMs } from "@/lib/apiMap";
import { api } from "@/lib/axios";
import { formatWhen } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface AuditEntry {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  actorName: string | null;
  changes: Record<string, unknown> | null;
  createdAt: number;
}

const ENTITY_LABEL: Record<string, string> = {
  product: "صنف",
  customer: "عميل",
  supplier: "مورد",
  user: "مستخدم",
  expense: "مصروف",
  cash_entry: "حركة خزنة",
  sale: "فاتورة بيع",
  purchase: "فاتورة شراء",
  shift: "وردية",
  shop: "المحل",
  backup: "نسخة احتياطية",
};

const ACTION_LABEL: Record<string, string> = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  toggle_active: "تفعيل/تعطيل",
  duplicate: "نسخ",
  stock_adjust: "تعديل مخزون",
  collect_payment: "تحصيل دفعة",
  payment: "سداد",
  return: "مرتجع",
  open: "فتح",
  close: "قفل",
  rename: "تغيير الاسم",
  price_from_purchase: "سعر من الشراء",
  login: "تسجيل دخول",
  reset_password: "إعادة كلمة المرور",
  change_password: "تغيير كلمة المرور",
};

const DANGER = new Set(["delete", "stock_adjust", "return"]);

const ENTITY_OPTIONS = [
  { value: "all", label: "كل الأنواع" },
  ...Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label })),
];
const ACTION_OPTIONS = [
  { value: "all", label: "كل العمليات" },
  ...["create", "update", "delete", "stock_adjust", "return", "collect_payment", "close"].map((a) => ({
    value: a,
    label: ACTION_LABEL[a],
  })),
];

async function fetchAudit(f: { entity: string; action: string; actor: string; from: string; to: string; page: number; pageSize: number }) {
  const { data } = await api.get<{
    items: { id: string; entity: string; entity_id: string; action: string; actor_name: string | null; changes: Record<string, unknown> | null; created_at: string }[];
    total: number;
  }>("/audit-log", {
    params: cleanParams({
      entity: f.entity,
      action: f.action,
      actor_id: f.actor,
      date_from: f.from,
      date_to: f.to,
      page: f.page,
      page_size: f.pageSize,
    }),
  });
  return {
    total: data.total,
    items: data.items.map<AuditEntry>((r) => ({
      id: r.id,
      entity: r.entity,
      entityId: r.entity_id,
      action: r.action,
      actorName: r.actor_name,
      changes: r.changes,
      createdAt: toMs(r.created_at),
    })),
  };
}

const show = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

/** التغييرات: {حقل: {from, to}} تُعرض "قبل ← بعد"، وغيرها قيمة واحدة. */
function Changes({ changes }: { changes: Record<string, unknown> | null }) {
  if (!changes || Object.keys(changes).length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <dl className="grid gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-[auto_1fr]">
      {Object.entries(changes).map(([key, value]) => {
        const diff = value && typeof value === "object" && "from" in value && "to" in value ? (value as { from: unknown; to: unknown }) : null;
        return (
          <div key={key} className="contents">
            <dt className="font-mono text-muted-foreground">{key}</dt>
            <dd className="min-w-0 break-words">
              {diff ? (
                <>
                  <span className="text-destructive line-through">{show(diff.from)}</span> ← <span className="text-success">{show(diff.to)}</span>
                </>
              ) : (
                show(value)
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** سجل العمليات: من فعل ماذا ومتى، بالتغييرات قبل وبعد. لا يمكن تعديله أو حذفه. */
export function AuditLogScreen() {
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [actor, setActor] = useState("all");
  const [period, setPeriod] = useState<PeriodValue>(periodOf("week"));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [expanded, setExpanded] = useState<string | null>(null);

  const actors = useQuery({
    queryKey: ["audit", "actors"],
    queryFn: async () => (await api.get<{ id: string; name: string }[]>("/audit-log/actors")).data,
  });
  const list = useQuery({
    queryKey: ["audit", entity, action, actor, period.range, page, pageSize],
    queryFn: () => fetchAudit({ entity, action, actor, from: period.range.from, to: period.range.to, page, pageSize }),
    placeholderData: keepPreviousData,
  });

  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(1);
  };

  const columns: AppTableColumn<AuditEntry>[] = [
    {
      id: "what",
      header: "العملية",
      skeletonClassName: "w-48",
      cell: (e) => (
        <div className="min-w-0 space-y-1.5">
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="outline" className={cn("font-normal", DANGER.has(e.action) && "border-destructive/50 text-destructive")}>
              {ACTION_LABEL[e.action] ?? e.action}
            </Badge>
            <span>{ENTITY_LABEL[e.entity] ?? e.entity}</span>
            <IconChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", expanded === e.id && "rotate-180")} />
          </p>
          {expanded === e.id && <Changes changes={e.changes} />}
        </div>
      ),
    },
    { id: "by", header: "بواسطة", cellClassName: "text-xs", cell: (e) => e.actorName ?? "—" },
    {
      id: "when",
      header: "الوقت",
      className: "hidden sm:table-cell",
      cellClassName: "text-xs text-muted-foreground",
      cell: (e) => formatWhen(e.createdAt),
    },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="سجل العمليات"
        description="كل إضافة وتعديل وحذف في النظام مسجّلة باسم من قام بها ووقتها. اضغط على أي عملية لرؤية التغييرات."
      />
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker value={period} onChange={reset(setPeriod)} />
        <OptionSelect label="النوع" items={ENTITY_OPTIONS} value={entity} onChange={reset(setEntity)} className="w-40" />
        <OptionSelect label="العملية" items={ACTION_OPTIONS} value={action} onChange={reset(setAction)} className="w-40" />
        <OptionSelect
          label="المستخدم"
          items={[{ value: "all", label: "كل المستخدمين" }, ...(actors.data ?? []).map((a) => ({ value: a.id, label: a.name }))]}
          value={actor}
          onChange={reset(setActor)}
          className="w-40"
        />
      </div>
      <AppTable
        data={list.data?.items ?? []}
        columns={columns}
        getRowId={(e) => e.id}
        onRowClick={(e) => setExpanded((cur) => (cur === e.id ? null : e.id))}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        isError={list.isError}
        errorMessage={extractErrorMessage(list.error, "تعذّر تحميل السجل")}
        onRetry={() => list.refetch()}
        isFiltered={entity !== "all" || action !== "all" || actor !== "all"}
        onClearFilters={() => {
          setEntity("all");
          setAction("all");
          setActor("all");
        }}
        empty={{ icon: IconHistory, title: "لا توجد عمليات في هذه الفترة" }}
        pagination={{
          total: list.data?.total ?? 0,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          pageSizes: [25, 50, 100],
          itemsLabel: "العمليات",
        }}
      />
    </div>
  );
}
