"use client";

import {
  IconGift,
  IconLoader2,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

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
import { Skeleton } from "@/components/ui/skeleton";
import { toMs } from "@/lib/apiMap";
import { api } from "@/lib/axios";
import { formatDateTime } from "@/lib/dates";
import { extractErrorMessage } from "@/lib/errors";
import { normalizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Customer } from "../types/customer";

type Kind = "earn" | "redeem" | "return" | "restore" | "adjust";

interface History {
  balance: number;
  items: {
    id: string;
    kind: Kind;
    points: number;
    balance_after: number;
    note: string | null;
    created_at: string;
  }[];
}

const KIND_LABEL: Record<Kind, string> = {
  earn: "كسب من فاتورة",
  redeem: "استبدال في فاتورة",
  return: "خصم بسبب مرتجع",
  restore: "استرداد نقاط مستبدلة",
  adjust: "تعديل يدوي",
};

const fetchHistory = async (id: string) =>
  (
    await api.get<History>(`/loyalty/customers/${id}`, {
      params: { page_size: 50 },
    })
  ).data;

/** كشف نقاط العميل + إضافة/خصم يدوي (هدية، تصحيح…). */
export function LoyaltyDialog({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const id = customer?.id ?? "";
  const history = useQuery({
    queryKey: ["customers", "loyalty", id],
    queryFn: () => fetchHistory(id),
    enabled: Boolean(customer),
  });
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");

  const adjust = useMutation({
    mutationFn: async (delta: number) =>
      (
        await api.post<History>(`/loyalty/customers/${id}/adjust`, {
          points: delta,
          note: note.trim(),
        })
      ).data,
    onSuccess: (data, delta) => {
      qc.setQueryData(["customers", "loyalty", id], data);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success(
        `${delta > 0 ? "أُضيفت" : "خُصمت"} ${Math.abs(delta)} نقطة · الرصيد ${data.balance}`,
      );
      setPoints("");
      setNote("");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر تعديل النقاط")),
  });

  const amount = Number(normalizeDigits(points).trim());
  const valid =
    Number.isInteger(amount) && amount > 0 && note.trim().length >= 2;

  function submit(sign: 1 | -1) {
    return (event?: FormEvent) => {
      event?.preventDefault();
      if (valid) adjust.mutate(sign * amount);
    };
  }

  const balance = history.data?.balance ?? customer?.loyaltyPoints ?? 0;

  return (
    <Dialog open={customer !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2">
            <IconGift className="size-5 text-success" />
            نقاط {customer?.name}
          </DialogTitle>
          <DialogDescription>
            الرصيد الحالي:{" "}
            <Num className="text-base font-semibold text-foreground">
              {balance}
            </Num>{" "}
            نقطة
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit(1)} className="space-y-2 border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            تعديل يدوي (هدية، تعويض، تصحيح)
          </p>
          <div className="flex gap-2">
            <Input
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              inputMode="numeric"
              dir="ltr"
              placeholder="عدد"
              aria-label="عدد النقاط"
              className="h-10 w-24 font-mono"
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="السبب (مثال: هدية عيد)"
              maxLength={200}
              className="h-10 flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={!valid || adjust.isPending}
              className="gap-1.5"
            >
              {adjust.isPending ? (
                <IconLoader2 className="size-4 animate-spin" />
              ) : (
                <IconPlus className="size-4" />
              )}
              إضافة
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!valid || adjust.isPending}
              onClick={() => submit(-1)()}
              className="gap-1.5"
            >
              <IconMinus className="size-4" />
              خصم
            </Button>
          </div>
        </form>

        {history.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !history.data?.items.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            لا توجد حركات نقاط بعد.
          </p>
        ) : (
          <ul className="divide-y border">
            {history.data.items.map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {KIND_LABEL[e.kind]}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {e.note} · {formatDateTime(toMs(e.created_at))}
                  </span>
                </span>
                <Num
                  className={cn(
                    "font-semibold",
                    e.points > 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {e.points > 0 ? `+${e.points}` : e.points}
                </Num>
                <Num className="w-12 text-end text-xs text-muted-foreground">
                  {e.balance_after}
                </Num>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
