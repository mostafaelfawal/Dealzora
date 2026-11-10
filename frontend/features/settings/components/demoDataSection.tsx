"use client";

import {
  IconDatabasePlus,
  IconFlask,
  IconLoader2,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/axios";
import { extractErrorMessage } from "@/lib/errors";

/** التوليد يمر بكل خدمات النظام (مئات الفواتير)، فيحتاج مهلة أطول من الافتراضي. */
const LONG_TIMEOUT = 5 * 60_000;
const IS_DEV = process.env.NODE_ENV === "development";

interface DemoStatus {
  enabled: boolean;
  loaded: boolean;
  records: number;
  tables: Record<string, number>;
  demo_password: string;
}

interface SeedResult {
  days: number;
  records: number;
  seconds: number;
  sales: number;
  returns: number;
  purchases: number;
  products: number;
  customers: number;
  suppliers: number;
}

/**
 * أدوات التطوير فقط: يظهر في `next dev` وعندما يكون الـ backend بـ POS_DEBUG=true.
 * في الإنتاج لا يُعرض القسم، ومسارات /dev غير موجودة أصلاً في الـ backend.
 */
export function DemoDataSection() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<"seed" | "clear" | null>(null);

  const status = useQuery({
    queryKey: ["devtools", "demo"],
    queryFn: async () => (await api.get<DemoStatus>("/dev/demo")).data,
    enabled: IS_DEV,
    retry: false,
  });

  const refreshAll = () => void qc.invalidateQueries();

  const seed = useMutation({
    mutationFn: async () =>
      (await api.post<SeedResult>("/dev/demo", null, { timeout: LONG_TIMEOUT }))
        .data,
    onSuccess: (r) => {
      refreshAll();
      toast.success(`تم إنشاء بيانات ${r.days} يوماً`, {
        description: `${r.sales} فاتورة · ${r.purchases} فاتورة شراء · ${r.products} صنف · ${r.customers} عميل (${r.records} سجل في ${r.seconds} ث)`,
        duration: 10_000,
      });
    },
    onError: (e) =>
      toast.error(extractErrorMessage(e, "تعذّر إنشاء البيانات التجريبية")),
    onSettled: () => setConfirm(null),
  });

  const clear = useMutation({
    mutationFn: async () =>
      (
        await api.delete<{ deleted: number; seconds: number }>("/dev/demo", {
          timeout: LONG_TIMEOUT,
        })
      ).data,
    onSuccess: (r) => {
      refreshAll();
      toast.success(`تم حذف ${r.deleted} سجل تجريبي`, {
        description: "بياناتك الحقيقية كما هي.",
      });
    },
    onError: (e) =>
      toast.error(extractErrorMessage(e, "تعذّر حذف البيانات التجريبية")),
    onSettled: () => setConfirm(null),
  });

  // خارج التطوير، أو الـ backend ليس في وضع debug (404) → لا شيء.
  if (!IS_DEV || !status.data?.enabled) return null;
  const s = status.data;
  const busy = seed.isPending || clear.isPending;

  return (
    <section className="space-y-3 border border-dashed border-warning/60 bg-warning/5 p-4">
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center bg-warning/15 text-warning [&_svg]:size-4"
        >
          <IconFlask />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            بيانات تجريبية
            <Badge
              variant="outline"
              className="border-warning/60 font-normal text-warning"
            >
              للتطوير فقط
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground">
            ينشئ محلاً كاملاً لآخر 60 يوماً عبر خدمات النظام نفسها: أصناف
            وأقسام، عملاء آجل، موردون، فواتير بيع وشراء، مرتجعات، ورديات،
            مصروفات، تحصيل وسداد. كل سجل يُحفظ رقمه، فالحذف يزيلها كلها دفعة
            واحدة دون لمس بياناتك الحقيقية.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {s.loaded ? (
          <>
            <Badge className="font-normal">
              محمّلة · {s.records.toLocaleString("en-US")} سجل
            </Badge>
            <span className="text-muted-foreground">
              دخول الكاشير التجريبي:{" "}
              <bdi dir="ltr" className="font-mono">
                demo.cashier1
              </bdi>{" "}
              /{" "}
              <bdi dir="ltr" className="font-mono select-all">
                {s.demo_password}
              </bdi>
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            لا توجد بيانات تجريبية الآن.
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="lg"
          disabled={busy || s.loaded}
          onClick={() => setConfirm("seed")}
          className="gap-2"
        >
          {seed.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconDatabasePlus className="size-4" />
          )}
          {seed.isPending
            ? "جارٍ الإنشاء… (حتى دقيقة)"
            : "إنشاء بيانات تجريبية"}
        </Button>
        <Button
          size="lg"
          variant="destructive"
          disabled={busy || !s.loaded}
          onClick={() => setConfirm("clear")}
          className="gap-2"
        >
          {clear.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconTrash className="size-4" />
          )}
          حذف البيانات التجريبية
        </Button>
      </div>

      <Dialog
        open={confirm !== null}
        onOpenChange={(next) => !next && !busy && setConfirm(null)}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader className="text-start">
            <DialogTitle>
              {confirm === "seed"
                ? "إنشاء بيانات تجريبية؟"
                : "حذف كل البيانات التجريبية؟"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "seed"
                ? "سيُنشأ أكثر من 600 فاتورة و10 آلاف سجل تقريباً. يلزم ألا تكون هناك وردية مفتوحة. ستبقى وردية تجريبية مفتوحة لليوم."
                : `سيُحذف ${s.records.toLocaleString("en-US")} سجل أنشأها المولّد فقط. لو بِعت صنفاً تجريبياً أو تعاملت مع عميل تجريبي بنفسك، سيُرفض الحذف كاملاً لحماية بياناتك.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              رجوع
            </Button>
            <Button
              size="lg"
              variant={confirm === "clear" ? "destructive" : "default"}
              disabled={busy}
              onClick={() =>
                confirm === "seed" ? seed.mutate() : clear.mutate()
              }
              className="gap-2"
            >
              {busy && <IconLoader2 className="size-4 animate-spin" />}
              {confirm === "seed" ? "إنشاء" : "حذف"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
