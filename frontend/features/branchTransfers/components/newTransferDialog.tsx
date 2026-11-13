"use client";

import {
  IconLoader2,
  IconSearch,
  IconSend,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";

import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeSearch } from "@/features/pos/lib/posCalc";
import type { Product } from "@/features/products/types/product";
import { fetchAllProducts } from "@/features/purchases/api/purchases.api";
import { formatQty, normalizeDigits, parseNumberInput } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  useBranches,
  useRequestTransfer,
  useSendTransfer,
} from "../hooks/useBranchTransfers";

export type TransferMode = "send" | "request";

interface Line {
  product: Product;
  qty: string;
}

const qtyOf = (t: string) => parseNumberInput(normalizeDigits(t));

function lineError(l: Line, mode: TransferMode): string | null {
  const q = qtyOf(l.qty);
  if (!(q > 0)) return "الكمية";
  if (!l.product.allowDecimal && !Number.isInteger(q)) return "بدون كسور";
  if (mode === "send" && q > l.product.stock)
    return `المتاح ${formatQty(l.product.stock)}`;
  return null;
}

function Form({ mode, onDone }: { mode: TransferMode; onDone: () => void }) {
  const branches = useBranches();
  const products = useQuery({
    queryKey: ["branch-transfers", "products"],
    queryFn: fetchAllProducts,
    staleTime: 30_000,
  });
  const send = useSendTransfer();
  const request = useRequestTransfer();
  const [branchId, setBranchId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const others = (branches.data ?? []).filter((b) => !b.isMe && b.isActive);
  const all = useMemo(
    () => (products.data ?? []).filter((p) => p.isActive),
    [products.data],
  );
  const q = normalizeSearch(query);
  const results = q
    ? all
        .filter(
          (p) => normalizeSearch(p.name).includes(q) || p.barcode.includes(q),
        )
        .slice(0, 8)
    : [];
  const errors = lines.map((l) => lineError(l, mode));
  const valid = branchId && lines.length > 0 && errors.every((e) => !e);
  const pending = send.isPending || request.isPending;

  function add(p: Product) {
    setLines((prev) =>
      prev.some((l) => l.product.id === p.id)
        ? prev
        : [...prev, { product: p, qty: "1" }],
    );
    setQuery("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    const items = lines.map((l) => ({
      productId: l.product.id,
      qty: qtyOf(l.qty),
    }));
    const opts = { onSuccess: onDone };
    if (mode === "send")
      send.mutate({ toBranchId: branchId, items, note }, opts);
    else request.mutate({ fromBranchId: branchId, items, note }, opts);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>{mode === "send" ? "إلى فرع" : "اطلب من فرع"}</Label>
        {branches.isPending ? (
          <p className="text-xs text-muted-foreground">جارٍ تحميل الفروع…</p>
        ) : others.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            مافيش فروع تانية مفعّلة في المحل.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {others.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={branchId === b.id}
                onClick={() => setBranchId(b.id)}
                className={cn(
                  "flex items-center gap-2 border px-3 py-2 text-sm",
                  branchId === b.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "hover:bg-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 rounded-full",
                    b.online ? "bg-success" : "bg-muted-foreground/40",
                  )}
                />
                {b.name}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {b.code}
                </span>
              </button>
            ))}
          </div>
        )}
        {submitted && !branchId && (
          <p className="text-xs text-destructive">اختر الفرع</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>الأصناف</Label>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              products.isPending
                ? "جارٍ تحميل الأصناف…"
                : "ابحث بالاسم أو امسح الباركود"
            }
            className="h-10 ps-8"
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                add(results[0]);
              }
            }}
          />
        </div>
        {results.length > 0 && (
          <ul className="max-h-48 divide-y overflow-y-auto border">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => add(p)}
                  className="flex w-full items-center gap-2 p-2 text-start text-sm hover:bg-muted"
                >
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    رصيدك <Num>{formatQty(p.stock)}</Num> {p.unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 ? (
          <ul className="divide-y border">
            {lines.map((l, i) => (
              <li key={l.product.id} className="flex items-center gap-2 p-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {l.product.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    رصيدك <Num>{formatQty(l.product.stock)}</Num>{" "}
                    {l.product.unit}
                    {l.product.trackExpiry && " · يخرج الأقرب انتهاءً"}
                  </span>
                </span>
                <Input
                  value={l.qty}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, qty: e.target.value } : x,
                      ),
                    )
                  }
                  inputMode="decimal"
                  dir="ltr"
                  aria-label={`كمية ${l.product.name}`}
                  aria-invalid={submitted && Boolean(errors[i])}
                  className="h-9 w-24 font-mono"
                />
                <span className="w-24 text-[11px] text-destructive">
                  {submitted && errors[i]}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`حذف ${l.product.name}`}
                  onClick={() =>
                    setLines((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  <IconTrash className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">لم تضف أصنافاً بعد.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tr-note">ملاحظة (اختياري)</Label>
        <Input
          id="tr-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          className="h-10"
        />
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          إلغاء
        </Button>
        <Button type="submit" size="lg" className="gap-2" disabled={pending}>
          {pending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconSend className="size-4" />
          )}
          {mode === "send" ? "إرسال (يُخصم من مخزونك)" : "إرسال الطلب"}
        </Button>
      </div>
    </form>
  );
}

export function NewTransferDialog({
  mode,
  onClose,
}: {
  mode: TransferMode | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-start">
          <DialogTitle>
            {mode === "send" ? "تحويل بضاعة لفرع" : "طلب بضاعة من فرع"}
          </DialogTitle>
          <DialogDescription>
            {mode === "send"
              ? "البضاعة بتتخصم من مخزونك لحظة الإرسال، وبتتضاف للفرع التاني لما يستلمها."
              : "الفرع التاني بيشوف طلبك، ويوافق ويبعت الكمية المتاحة عنده أو يرفض."}
          </DialogDescription>
        </DialogHeader>
        {mode && <Form key={mode} mode={mode} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
