"use client";

import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconCheck,
  IconPackageImport,
  IconSearch,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Money } from "@/components/shared/Money";
import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeSearch } from "@/features/pos/lib/posCalc";
import { fetchAllProducts } from "@/features/purchases/api/purchases.api";
import { formatDate, parseIsoDay } from "@/lib/dates";
import { formatQty, normalizeDigits, parseNumberInput } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Transfer, TransferLine } from "../api/branchTransfers.api";
import {
  useApproveTransfer,
  useReceiveTransfer,
  useTransfer,
  useTransferAction,
} from "../hooks/useBranchTransfers";
import { STATUS_INFO } from "../lib/transferText";

type Mode = "receive" | "approve";

/** اختيار الصنف المقابل في هذا الفرع لسطر لم يُطابَق تلقائياً. */
function MapPicker({
  value,
  onChange,
}: {
  value: { id: string; name: string } | null;
  onChange: (p: { id: string; name: string } | null) => void;
}) {
  const products = useQuery({
    queryKey: ["branch-transfers", "products"],
    queryFn: fetchAllProducts,
    staleTime: 30_000,
  });
  const [q, setQ] = useState("");
  const term = normalizeSearch(q);
  const results = useMemo(
    () =>
      term
        ? (products.data ?? [])
            .filter(
              (p) =>
                p.isActive &&
                (normalizeSearch(p.name).includes(term) ||
                  p.barcode.includes(term)),
            )
            .slice(0, 6)
        : [],
    [products.data, term],
  );
  if (value)
    return (
      <span className="inline-flex items-center gap-1 bg-primary/10 px-2 py-0.5 text-xs text-primary">
        ← {value.name}
        <button type="button" aria-label="تغيير" onClick={() => onChange(null)}>
          <IconX className="size-3" />
        </button>
      </span>
    );
  return (
    <div className="relative">
      <IconSearch className="pointer-events-none absolute inset-s-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="اختر الصنف المقابل عندك"
        className="h-8 ps-7 text-xs"
        aria-invalid
      />
      {results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-10 max-h-40 divide-y overflow-y-auto border bg-popover shadow">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange({ id: p.id, name: p.name })}
                className="w-full p-1.5 text-start text-xs hover:bg-muted"
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LineView({ l, t }: { l: TransferLine; t: Transfer }) {
  const shortage = l.qtyReceived !== null && l.qtyReceived < l.qtySent;
  return (
    <li className="flex items-start gap-3 p-2.5 text-sm">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{l.name}</span>
        <span className="text-[11px] text-muted-foreground">
          {l.batchNo && `تشغيلة ${l.batchNo} · `}
          {l.expiryDate && `صلاحية ${formatDate(parseIsoDay(l.expiryDate))} · `}
          {t.role === "receiver" &&
            l.match &&
            l.match.name !== l.name &&
            `عندك: ${l.match.name}`}
        </span>
      </span>
      <span className="text-end text-xs whitespace-nowrap">
        {l.qtyRequested !== null && t.status === "requested" ? (
          <>
            مطلوب <Num>{formatQty(l.qtyRequested)}</Num>
          </>
        ) : (
          <>
            <Num>{formatQty(l.qtySent)}</Num> {l.unit}
            {l.qtyReceived !== null && (
              <span
                className={cn(
                  "block",
                  shortage ? "text-destructive" : "text-success",
                )}
              >
                وصل <Num>{formatQty(l.qtyReceived)}</Num>
              </span>
            )}
          </>
        )}
      </span>
    </li>
  );
}

/** استلام (كمية فعلية لكل سطر) أو موافقة (كمية متاحة لكل سطر)، مع اختيار الصنف المقابل عند الحاجة. */
function LinesForm({
  t,
  mode,
  onDone,
}: {
  t: Transfer;
  mode: Mode;
  onDone: () => void;
}) {
  const receive = useReceiveTransfer();
  const approve = useApproveTransfer();
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      t.lines.map((l) => [
        l.id,
        String(
          mode === "receive"
            ? l.qtySent
            : Math.min(l.qtyRequested ?? l.qtySent, l.match?.stock ?? 0),
        ),
      ]),
    ),
  );
  const [map, setMap] = useState<
    Record<string, { id: string; name: string } | null>
  >({});
  const [note, setNote] = useState("");
  const pending = receive.isPending || approve.isPending;

  const rows = t.lines.map((l) => {
    const n = parseNumberInput(normalizeDigits(qty[l.id] ?? ""));
    const max = mode === "receive" ? l.qtySent : (l.qtyRequested ?? l.qtySent);
    const product =
      map[l.id] ??
      (l.match ? { id: l.match.productId, name: l.match.name } : null);
    const error =
      !(n >= 0) || n > max
        ? `من 0 إلى ${formatQty(max)}`
        : n > 0 && !product
          ? "اختر الصنف"
          : mode === "approve" && l.match && !map[l.id] && n > l.match.stock
            ? `رصيدك ${formatQty(l.match.stock)}`
            : null;
    return { l, n, product, error };
  });
  const valid =
    rows.every((r) => !r.error) &&
    (mode === "receive" || rows.some((r) => r.n > 0));

  function submit() {
    if (!valid) return;
    const items = rows.map((r) => ({
      lineId: r.l.id,
      qty: r.n,
      productId: map[r.l.id]?.id,
    }));
    if (mode === "receive")
      receive.mutate({ id: t.id, items, note }, { onSuccess: onDone });
    else approve.mutate({ id: t.id, items }, { onSuccess: onDone });
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y border">
        {rows.map(({ l, error, product }) => (
          <li key={l.id} className="space-y-1.5 p-2.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {l.name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {mode === "receive" ? (
                    <>
                      اتبعت <Num>{formatQty(l.qtySent)}</Num> {l.unit}
                    </>
                  ) : (
                    <>
                      مطلوب <Num>{formatQty(l.qtyRequested ?? l.qtySent)}</Num>
                      {l.match && (
                        <>
                          {" "}
                          · رصيدك <Num>{formatQty(l.match.stock)}</Num>
                        </>
                      )}
                    </>
                  )}
                  {l.expiryDate &&
                    ` · صلاحية ${formatDate(parseIsoDay(l.expiryDate))}`}
                </span>
              </span>
              <Input
                value={qty[l.id]}
                onChange={(e) =>
                  setQty((p) => ({ ...p, [l.id]: e.target.value }))
                }
                inputMode="decimal"
                dir="ltr"
                aria-label={`كمية ${l.name}`}
                aria-invalid={Boolean(error)}
                className="h-8 w-20 font-mono"
              />
            </div>
            {!l.match || map[l.id] !== undefined ? (
              <MapPicker
                value={product && (map[l.id] || !l.match) ? product : null}
                onChange={(p) => setMap((m) => ({ ...m, [l.id]: p }))}
              />
            ) : null}
            {error && <p className="text-[11px] text-destructive">{error}</p>}
          </li>
        ))}
      </ul>
      {mode === "receive" && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ملاحظة الاستلام (مثلاً: علبتين مكسورين)"
          maxLength={300}
          className="h-10"
        />
      )}
      <Button
        size="lg"
        className="w-full gap-2"
        disabled={!valid || pending}
        onClick={submit}
      >
        {mode === "receive" ? (
          <IconPackageImport className="size-4" />
        ) : (
          <IconSend className="size-4" />
        )}
        {mode === "receive"
          ? "تأكيد الاستلام (يُضاف لمخزونك)"
          : "موافقة وإرسال (يُخصم من مخزونك)"}
      </Button>
    </div>
  );
}

function Actions({ t, onClose }: { t: Transfer; onClose: () => void }) {
  const action = useTransferAction();
  const [mode, setMode] = useState<Mode | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const run = (a: "withdraw" | "cancel") =>
    action.mutate({ id: t.id, action: a }, { onSuccess: onClose });

  if (mode === "receive" || mode === "approve")
    return <LinesForm t={t} mode={mode} onDone={onClose} />;
  if (mode === "reject")
    return (
      <div className="space-y-2">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سبب الرفض"
          maxLength={300}
          className="h-10"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setMode(null)}>
            رجوع
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 2 || action.isPending}
            onClick={() =>
              action.mutate(
                { id: t.id, action: "reject", reason: reason.trim() },
                { onSuccess: onClose },
              )
            }
          >
            رفض الطلب
          </Button>
        </div>
      </div>
    );

  const sender = t.role === "sender";
  if (t.status === "sent" && !sender)
    return (
      <Button
        size="lg"
        className="w-full gap-2"
        onClick={() => setMode("receive")}
      >
        <IconPackageImport className="size-4" />
        استلام البضاعة
      </Button>
    );
  if (t.status === "requested" && sender)
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" className="gap-2" onClick={() => setMode("approve")}>
          <IconCheck className="size-4" />
          موافقة وإرسال
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2 text-destructive"
          onClick={() => setMode("reject")}
        >
          <IconX className="size-4" />
          رفض
        </Button>
      </div>
    );
  if (t.status === "requested" && !sender)
    return (
      <Button
        size="lg"
        variant="outline"
        className="w-full gap-2"
        disabled={action.isPending}
        onClick={() => run("withdraw")}
      >
        <IconArrowBackUp className="size-4" />
        سحب الطلب
      </Button>
    );
  if (t.status === "sent" && sender)
    return (
      <Button
        size="lg"
        variant="outline"
        className="w-full gap-2 text-destructive"
        disabled={action.isPending}
        onClick={() => run("cancel")}
      >
        <IconArrowBackUp className="size-4" />
        إلغاء التحويل (ترجع البضاعة لمخزونك)
      </Button>
    );
  return null;
}

export function TransferDetailSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const q = useTransfer(id);
  const t = q.data;
  const info = t ? STATUS_INFO[t.status] : null;
  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="left"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            تحويل #{t?.number ?? "…"}
            {info && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[11px] font-normal",
                  info.className,
                )}
              >
                {info.label}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            {t ? `${t.fromBranchName} ← ${t.toBranchName}` : "جارٍ التحميل…"}
          </SheetDescription>
        </SheetHeader>
        {!t ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 p-4">
            {t.local?.pending && (
              <p className="flex items-start gap-2 bg-warning/10 p-2 text-xs text-warning">
                <IconAlertTriangle className="size-4 shrink-0" />
                اتخصم من مخزونك ولسه ما وصلش للسيرفر. هيتبعت تلقائياً أول ما
                الاتصال يرجع.
              </p>
            )}
            <ul className="divide-y border">
              {t.lines.map((l) => (
                <LineView key={l.id} l={l} t={t} />
              ))}
            </ul>
            <dl className="space-y-1 text-xs">
              {t.totalCost > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    قيمة التحويل (تكلفة)
                  </dt>
                  <dd>
                    <Money amount={t.totalCost} />
                  </dd>
                </div>
              )}
              {t.shortageCost > 0 && (
                <div className="flex justify-between text-destructive">
                  <dt>قيمة العجز</dt>
                  <dd>
                    <Money amount={t.shortageCost} />
                  </dd>
                </div>
              )}
              {t.requestedBy && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">طلبه</dt>
                  <dd>{t.requestedBy}</dd>
                </div>
              )}
              {t.sentBy && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">أرسله</dt>
                  <dd>{t.sentBy}</dd>
                </div>
              )}
              {t.receivedBy && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">استلمه</dt>
                  <dd>{t.receivedBy}</dd>
                </div>
              )}
              {t.note && (
                <p className="pt-1 text-muted-foreground">ملاحظة: {t.note}</p>
              )}
              {t.receiveNote && (
                <p className="text-muted-foreground">
                  ملاحظة الاستلام: {t.receiveNote}
                </p>
              )}
              {t.rejectReason && (
                <p className="text-destructive">سبب الرفض: {t.rejectReason}</p>
              )}
            </dl>
            <div className="mt-auto">
              <Actions key={t.id + t.status} t={t} onClose={onClose} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
