"use client";

import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconCloudOff,
  IconInbox,
  IconPackageExport,
  IconPackageImport,
  IconRefresh,
  IconSend,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";

import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatTile } from "@/components/shared/StatTile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { Transfer, TransferStatus } from "../api/branchTransfers.api";
import {
  useBranchStatus,
  useRetryPending,
  useTransfers,
  useTransfersSummary,
} from "../hooks/useBranchTransfers";
import { STATUS_INFO } from "../lib/transferText";
import { NewTransferDialog, type TransferMode } from "./newTransferDialog";
import { TransferDetailSheet } from "./transferDetailSheet";

type Tab = "in" | "requests" | "out" | "all";

const TAB_QUERY: Record<
  Tab,
  { direction: "in" | "out" | "all"; status?: TransferStatus }
> = {
  in: { direction: "in" },
  requests: { direction: "out", status: "requested" },
  out: { direction: "out" },
  all: { direction: "all" },
};

function when(t: Transfer) {
  const iso = t.receivedAt ?? t.sentAt ?? t.requestedAt;
  return iso ? formatDate(Date.parse(iso)) : "";
}

function TransferCard({ t, onOpen }: { t: Transfer; onOpen: () => void }) {
  const info = STATUS_INFO[t.status];
  const outgoing = t.role === "sender";
  const other = outgoing ? t.toBranchName : t.fromBranchName;
  const needsMe =
    (t.status === "sent" && !outgoing) ||
    (t.status === "requested" && outgoing);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-center gap-3 border p-3 text-start hover:bg-muted/50",
          needsMe && "border-primary/50 bg-primary/5",
        )}
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center",
            outgoing
              ? "bg-warning/10 text-warning"
              : "bg-success/10 text-success",
          )}
        >
          {outgoing ? (
            <IconPackageExport className="size-5" />
          ) : (
            <IconPackageImport className="size-5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-medium">
            #{t.number} · {outgoing ? "إلى" : "من"} {other}
            <span
              className={cn(
                "px-1.5 py-0.5 text-[11px] font-normal",
                info.className,
              )}
            >
              {info.label}
            </span>
            {t.local?.pending && (
              <IconCloudOff
                className="size-4 text-warning"
                aria-label="لم يُرسل بعد"
              />
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {t.lines.length} صنف ·{" "}
            {t.lines
              .slice(0, 3)
              .map((l) => l.name)
              .join("، ")}
            {t.lines.length > 3 && "…"}
          </span>
        </span>
        <span className="text-end text-xs text-muted-foreground">
          {t.totalCost > 0 && (
            <Money amount={t.totalCost} className="block text-foreground" />
          )}
          {when(t)}
        </span>
      </button>
    </li>
  );
}

export function TransfersScreen() {
  const status = useBranchStatus();
  const connected = Boolean(status.data?.connected);
  const summary = useTransfersSummary(connected);
  const retry = useRetryPending();
  const [tab, setTab] = useState<Tab>("in");
  const [mode, setMode] = useState<TransferMode | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = TAB_QUERY[tab];
  const list = useTransfers(q.direction, q.status, connected);
  const s = summary.data;

  if (status.isPending)
    return (
      <div className="mx-auto max-w-5xl space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  if (!connected)
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center">
        <IconArrowsExchange className="size-12 text-muted-foreground" />
        <h1 className="text-lg font-semibold">
          الجهاز ده مش مربوط بسيرفر الفروع
        </h1>
        <p className="text-sm text-muted-foreground">
          اربط كل فرع مرة واحدة بكود الربط، وبعدها تقدر تبعت بضاعة لفرع تاني أو
          تطلب منه.
        </p>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/admin/settings#branches" />}
        >
          ربط الفرع من الإعدادات
        </Button>
      </div>
    );

  const items = list.data?.items ?? [];
  const tabs = [
    { id: "in" as const, label: "الوارد لي", count: s?.incoming || undefined },
    {
      id: "requests" as const,
      label: "طلبات مني",
      count: s?.requests || undefined,
    },
    { id: "out" as const, label: "الصادر مني" },
    { id: "all" as const, label: "الكل" },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="تحويلات الفروع"
        description={`أنت فرع «${status.data?.branchName ?? ""}». البضاعة بتتخصم منك لحظة الإرسال وبتتضاف للفرع التاني لما يستلمها.`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => setMode("request")}
            >
              <IconInbox className="size-4" /> طلب من فرع
            </Button>
            <Button className="gap-1.5" onClick={() => setMode("send")}>
              <IconSend className="size-4" /> تحويل لفرع
            </Button>
          </div>
        }
      />

      {s && (s.unpaired || !s.online) && (
        <p className="flex items-center gap-2 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <IconCloudOff className="size-4 shrink-0" />
          {s.unpaired ? (
            <>
              الربط اتلغى من السيرفر (اتغيّر سر الفرع). اربطه تاني بكود جديد من{" "}
              <Link href="/admin/settings#branches" className="underline">
                الإعدادات
              </Link>
              .
            </>
          ) : (
            "سيرفر الفروع غير متاح الآن. تقدر تبعت تحويل وهيتخصم ويتبعت أول ما الاتصال يرجع."
          )}
        </p>
      )}

      {(s?.pending ?? 0) > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-warning/40 bg-warning/5 p-3 text-sm">
          <span className="flex items-center gap-2">
            <IconAlertTriangle className="size-4 text-warning" />
            {s?.pending} تحويل اتخصم من مخزونك ولسه ما وصلش للسيرفر.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={retry.isPending}
            onClick={() => retry.mutate()}
          >
            <IconRefresh className="size-4" /> إعادة الإرسال
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <StatTile
          index={0}
          icon={<IconPackageImport />}
          label="بضاعة جاية لك"
          tone={s?.incoming ? "success" : "default"}
          onClick={() => setTab("in")}
          active={tab === "in"}
        >
          {s?.incoming ?? 0}
        </StatTile>
        <StatTile
          index={1}
          icon={<IconInbox />}
          label="طلبات مستنياك"
          tone={s?.requests ? "warning" : "default"}
          onClick={() => setTab("requests")}
          active={tab === "requests"}
        >
          {s?.requests ?? 0}
        </StatTile>
        <StatTile
          index={2}
          icon={<IconCloudOff />}
          label="معلّق (لم يُرسل)"
          tone={s?.pending ? "danger" : "default"}
        >
          {s?.pending ?? 0}
        </StatTile>
      </div>

      <SegmentedTabs
        label="التحويلات"
        items={tabs}
        value={tab}
        onChange={setTab}
      />

      {list.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          تعذّر جلب التحويلات من السيرفر. هنحاول تاني تلقائياً.
        </p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {tab === "in"
            ? "مافيش بضاعة جاية لك دلوقتي."
            : tab === "requests"
              ? "مافيش طلبات مستنياك."
              : "مافيش تحويلات."}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <TransferCard key={t.id} t={t} onOpen={() => setOpenId(t.id)} />
          ))}
        </ul>
      )}

      <NewTransferDialog mode={mode} onClose={() => setMode(null)} />
      <TransferDetailSheet id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
