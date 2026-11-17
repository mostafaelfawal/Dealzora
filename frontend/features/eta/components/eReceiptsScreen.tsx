"use client";

import {
  IconAlertTriangle,
  IconCircleX,
  IconClockHour4,
  IconExternalLink,
  IconFileCertificate,
  IconHourglassHigh,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { AppTable } from "@/components/shared/AppTable/AppTable";
import {
  CardBadges,
  CardFoot,
  CardHead,
} from "@/components/shared/AppTable/AppTableCards";
import type { AppTableColumn } from "@/components/shared/AppTable/types";
import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  PeriodPicker,
  periodOf,
  type PeriodValue,
} from "@/components/shared/PeriodPicker";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import { ViewToggle } from "@/components/shared/ViewToggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { SaleDetailSheet } from "@/features/sales/components/saleDetailSheet";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useViewMode } from "@/hooks/useViewMode";
import { toMs, toPounds } from "@/lib/apiMap";
import { formatWhen } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

import { RESEND_LABEL } from "../config/receiptStatus";
import {
  useReceiptQueue,
  useReceipts,
  useResendReceipts,
} from "../hooks/useEta";
import type { EReceiptStatus, ReceiptItem } from "../types/eta";
import { StatusChip } from "./statusChip";

type StatusTab = "attention" | "all" | EReceiptStatus;

const STATUS_TABS: readonly { id: StatusTab; label: string }[] = [
  { id: "attention", label: "يحتاج انتباهاً" },
  { id: "all", label: "الكل" },
  { id: "not_sent", label: "لم يُرسل" },
  { id: "pending", label: "معلّق" },
  { id: "accepted", label: "مقبول" },
  { id: "not_required", label: "غير مطلوب" },
];

const KINDS = [
  { value: "all", label: "بيع ومرتجع" },
  { value: "sale", label: "فواتير البيع" },
  { value: "return", label: "المرتجعات" },
] as const;

const PAGE_SIZE = 50;

const label = (r: ReceiptItem) =>
  r.kind === "sale" ? `فاتورة #${r.number}` : `مرتجع #${r.number}`;

/** سبب المشكلة بالعربي + ماذا أفعل + رسالة المنظومة الأصلية. */
function Problem({ r, full = false }: { r: ReceiptItem; full?: boolean }) {
  if (!r.help_title && !r.late) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-0 space-y-0.5 text-xs">
      {r.help_title && <p className="font-medium">{r.help_title}</p>}
      {r.help_action && <p className="text-muted-foreground">{r.help_action}</p>}
      {r.error && (
        <AppTooltip message={r.error} onlyWhenTruncated={!full}>
          <p className={cn("text-[11px] text-muted-foreground/80", !full && "truncate")} dir="auto">
            {r.error}
          </p>
        </AppTooltip>
      )}
      {r.late && (
        <p className={r.overdue ? "text-destructive" : "text-warning"}>
          {r.overdue ? "تجاوز مهلة الـ 24 ساعة" : "يقترب من مهلة الـ 24 ساعة"}
        </p>
      )}
    </div>
  );
}

function ReceiptCard({
  r,
  busy,
  onResend,
}: {
  r: ReceiptItem;
  busy: boolean;
  onResend: () => void;
}) {
  return (
    <>
      <CardHead
        title={<span className="font-mono text-sm font-semibold">{label(r)}</span>}
        subtitle={r.device_name ?? "—"}
        aside={<Money amount={toPounds(r.total)} className="text-base font-semibold" />}
      />
      <CardBadges>
        <StatusChip status={r.status} />
        {r.replaced_uuid && <span className="text-[11px] text-muted-foreground">مُصحَّح</span>}
      </CardBadges>
      <Problem r={r} full />
      {r.resend && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onResend}
          className="w-full gap-1 font-normal"
        >
          <IconRefresh className="size-4" />
          {RESEND_LABEL[r.resend]}
        </Button>
      )}
      <CardFoot>
        <span>{formatWhen(toMs(r.issued_at))}</span>
        {r.uuid && (
          <span className="truncate font-mono text-[10px]" dir="ltr">
            {r.uuid.slice(0, 16)}…
          </span>
        )}
      </CardFoot>
    </>
  );
}

/** تأكيد تصحيح إيصالات مرفوضة مرّ عليها أكثر من 96 ساعة (المنظومة قد ترفضها). */
function LateDialog({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle>تصحيح إيصالات متأخرة</DialogTitle>
          <DialogDescription>
            <Num>{count}</Num> إيصال مرفوض مرّ عليه أكثر من 96 ساعة. المنظومة
            لا تقبل تصحيحه بعد هذه المدة إلا بطلب إرسال متأخر من المصلحة. هل
            ترسله على أي حال؟
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            رجوع
          </Button>
          <Button type="button" onClick={onConfirm}>
            أرسله على أي حال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** شاشة «الإيصالات الإلكترونية» لهذا الفرع: الحالة، سبب الرفض، إعادة الإرسال، والفاتورة المرتبطة. */
export function EReceiptsScreen() {
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 300);
  const [period, setPeriod] = useState<PeriodValue>(periodOf("week"));
  const [status, setStatus] = useState<StatusTab>("attention");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("all");
  const [device, setDevice] = useState("all");
  const [page, setPage] = useState(1);
  const [openSale, setOpenSale] = useState<string | null>(null);
  const [pendingLate, setPendingLate] = useState<ReceiptItem[] | null>(null);
  const { view, setView } = useViewMode("e-receipts");
  const narrow = useMediaQuery("(max-width: 767px)");
  const queue = useReceiptQueue();
  const resend = useResendReceipts();

  const byNumber = /^(#|R-)?\d+$/i.test(q.trim());
  const query = {
    status: status === "all" ? undefined : status,
    kind: kind === "all" ? undefined : kind,
    device_id: device === "all" ? undefined : device,
    date_from: byNumber ? undefined : period.range.from,
    date_to: byNumber ? undefined : period.range.to,
    q: q.trim() || undefined,
    page,
    page_size: PAGE_SIZE,
  };
  const list = useReceipts(query);
  const rows = list.data?.items ?? [];
  const resendable = rows.filter((r) => r.resend);
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  function runResend(items: ReceiptItem[], acceptLate = false) {
    const target = items.filter((r) => r.resend);
    if (!target.length) return;
    if (!acceptLate && target.some((r) => r.amendment_late)) {
      setPendingLate(target);
      return;
    }
    resend.mutate({ items: target.map((r) => ({ kind: r.kind, id: r.id })), acceptLate });
  }

  const columns = useMemo<AppTableColumn<ReceiptItem>[]>(
    () => [
      {
        id: "doc",
        header: "الإيصال",
        cell: (r) => (
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold">{label(r)}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatWhen(toMs(r.issued_at))} · {r.device_name ?? "—"}
            </p>
          </div>
        ),
      },
      {
        id: "status",
        header: "الحالة",
        className: "w-28",
        cell: (r) => (
          <div className="space-y-0.5">
            <StatusChip status={r.status} />
            {r.replaced_uuid && <p className="text-[11px] text-muted-foreground">مُصحَّح</p>}
          </div>
        ),
      },
      {
        id: "problem",
        header: "السبب وماذا أفعل",
        cellClassName: "max-w-96",
        cell: (r) => <Problem r={r} />,
      },
      {
        id: "total",
        header: "الإجمالي",
        className: "hidden lg:table-cell w-28",
        cell: (r) => <Money amount={toPounds(r.total)} className="text-sm" />,
      },
      {
        id: "actions",
        header: <span className="sr-only">إجراءات</span>,
        className: "w-56",
        cell: (r) => (
          <div className="flex justify-end gap-1">
            {r.resend && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={resend.isPending}
                onClick={() => runResend([r])}
                className="gap-1 font-normal"
              >
                <IconRefresh className="size-4" />
                {RESEND_LABEL[r.resend]}
              </Button>
            )}
            <AppTooltip message="فتح الفاتورة المرتبطة">
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`فتح الفاتورة المرتبطة بـ ${label(r)}`}
                onClick={() => setOpenSale(r.sale_id)}
              >
                <IconExternalLink className="size-4" />
              </Button>
            </AppTooltip>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resend.isPending],
  );

  const q0 = queue.data;
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <PageHeader
        title="الإيصالات الإلكترونية"
        description="حالة إيصالات هذا الفرع في منظومة الضرائب: المرفوض وسببه، وإعادة الإرسال، والفاتورة المرتبطة. أعداد الفروع الأخرى في تقرير الفروع."
      />

      {q0 && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <StatTile index={0} icon={<IconClockHour4 />} label="لم يصل بعد">
            <Num>{q0.waiting}</Num>
          </StatTile>
          <StatTile
            index={1}
            icon={<IconCircleX />}
            label="مرفوض / خطأ تحقق"
            tone={q0.rejected ? "danger" : "default"}
          >
            <Num>{q0.rejected}</Num>
          </StatTile>
          <StatTile
            index={2}
            icon={<IconHourglassHigh />}
            label="يقترب من مهلة 24 ساعة"
            tone={q0.late ? "warning" : "default"}
          >
            <Num>{q0.late}</Num>
          </StatTile>
          <StatTile
            index={3}
            icon={<IconAlertTriangle />}
            label="تجاوز المهلة"
            tone={q0.overdue ? "danger" : "default"}
          >
            <Num>{q0.overdue}</Num>
          </StatTile>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="h-10 min-w-48 flex-1">
            <InputGroupAddon>
              <IconSearch />
            </InputGroupAddon>
            <InputGroupInput
              data-page-search
              value={search}
              onChange={(e) => reset(setSearch)(e.target.value)}
              placeholder="رقم الفاتورة أو المرتجع…"
              aria-label="بحث برقم الفاتورة"
            />
          </InputGroup>
          <PeriodPicker value={period} onChange={reset(setPeriod)} />
          <OptionSelect label="النوع" items={KINDS} value={kind} onChange={reset(setKind)} className="w-36" />
          <OptionSelect
            label="الجهاز"
            items={[
              { value: "all", label: "كل الأجهزة" },
              ...(list.data?.devices ?? []).map((d) => ({ value: d.id, label: d.name })),
            ]}
            value={device}
            onChange={reset(setDevice)}
            className="w-40"
          />
          {!narrow && <ViewToggle view={view} onChange={setView} hotkey={openSale === null} />}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedTabs label="حالة الإيصال" items={STATUS_TABS} value={status} onChange={reset(setStatus)} />
          {resendable.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={resend.isPending}
              onClick={() => runResend(resendable)}
            >
              <IconRefresh className="size-4" />
              إعادة إرسال ما يحتاج في الصفحة (<Num>{resendable.length}</Num>)
            </Button>
          )}
        </div>
      </div>

      <AppTable
        data={rows}
        columns={columns}
        getRowId={(r) => `${r.kind}:${r.id}`}
        isLoading={list.isPending}
        isFetching={list.isFetching}
        isError={list.isError}
        errorMessage={extractErrorMessage(list.error, "تعذّر تحميل الإيصالات")}
        onRetry={() => list.refetch()}
        isFiltered={status !== "all" || kind !== "all" || device !== "all" || Boolean(q)}
        onClearFilters={() => {
          setStatus("all");
          setKind("all");
          setDevice("all");
          setSearch("");
          setPage(1);
        }}
        empty={{
          icon: IconFileCertificate,
          title: "لا توجد إيصالات في هذه الفترة",
          description: "الإيصالات تتولد مع كل بيع بعد تفعيل المنظومة من الإعدادات.",
        }}
        noResults={{
          title: status === "attention" ? "لا شيء يحتاج انتباهاً" : "لا توجد إيصالات مطابقة",
          description: status === "attention" ? "كل الإيصالات في هذه الفترة سليمة." : "جرّب فترة أو حالة أخرى.",
        }}
        rowHeightClassName="h-16"
        selectable
        isRowSelectable={(r) => Boolean(r.resend)}
        getRowLabel={label}
        bulkActions={{
          isPending: resend.isPending,
          extra: [
            {
              key: "resend",
              label: "إعادة إرسال المحدد",
              icon: IconRefresh,
              onClick: (selected, clear) => {
                runResend(selected);
                clear();
              },
            },
          ],
        }}
        view={narrow ? "cards" : view}
        renderCard={(r) => (
          <ReceiptCard r={r} busy={resend.isPending} onResend={() => runResend([r])} />
        )}
        onRowClick={(r) => setOpenSale(r.sale_id)}
        getCardLabel={label}
        pagination={{
          total: list.data?.total ?? 0,
          page,
          pageSize: PAGE_SIZE,
          onPageChange: setPage,
          onPageSizeChange: () => undefined,
          pageSizes: [PAGE_SIZE],
          itemsLabel: "الإيصالات",
        }}
      />

      <SaleDetailSheet saleId={openSale} onClose={() => setOpenSale(null)} onReturn={() => setOpenSale(null)} />
      {pendingLate && (
        <LateDialog
          count={pendingLate.filter((r) => r.amendment_late).length}
          onCancel={() => setPendingLate(null)}
          onConfirm={() => {
            const items = pendingLate;
            setPendingLate(null);
            runResend(items, true);
          }}
        />
      )}
    </div>
  );
}
