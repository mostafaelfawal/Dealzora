"use client";

import { IconLoader2, IconSend } from "@tabler/icons-react";

import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toMs } from "@/lib/apiMap";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

import {
  useEtaConfig,
  useEtaDevices,
  useReleaseReturn,
  useSendAttempts,
  useSendNow,
  useSendStatus,
} from "../hooks/useEta";
import type { SendAttempt } from "../types/eta";

const STATUS: { key: string; label: string; tone: string }[] = [
  { key: "not_sent", label: "لم يُرسل", tone: "" },
  { key: "pending", label: "معلّق", tone: "" },
  { key: "accepted", label: "مقبول", tone: "text-success" },
  { key: "rejected", label: "مرفوض", tone: "text-destructive" },
  { key: "invalid", label: "خطأ تحقق", tone: "text-destructive" },
];

const OPERATION: Record<SendAttempt["operation"], string> = {
  test: "اختبار",
  submit: "إرسال",
  poll: "متابعة",
};

const OUTCOME: Record<string, string> = {
  ok: "نجح",
  partial: "رفض جزئي",
  rejected: "مرفوض",
  duplicate: "مكرر (أُرسل سابقاً)",
  network: "خطأ شبكة",
  rate_limited: "انتظار (حد الطلبات)",
  auth_failed: "فشل المصادقة",
  bad_request: "خطأ في الطلب",
};

/** حالة الإرسال للمنظومة: الأعداد، تنبيهات الأجهزة، زر «إرسال الآن»، وآخر المحاولات للتشخيص. */
export function EtaSending() {
  const config = useEtaConfig();
  const status = useSendStatus();
  const attempts = useSendAttempts();
  const devices = useEtaDevices();
  const send = useSendNow();
  const release = useReleaseReturn();
  if (!status.data || !config.data) return <Skeleton className="h-32 w-full" />;
  const names = new Map((devices.data ?? []).map((d) => [d.device_id, d.name]));
  const alerts = Object.entries(status.data.devices).filter(
    ([, s]) => s.auth_error || s.wait_seconds > 0 || s.held_by,
  );
  const { late, overdue } = status.data.queue ?? { late: 0, overdue: 0 };

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {STATUS.map((s) => (
          <div key={s.key} className="border p-2 text-center">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className={cn("text-lg font-semibold", s.tone)}>
              <Num>{status.data.counts[s.key] ?? 0}</Num>
            </dd>
          </div>
        ))}
      </dl>

      {(late > 0 || overdue > 0) && (
        <p
          role="alert"
          className="border border-warning/40 bg-warning/5 px-3 py-2 text-sm"
        >
          {overdue > 0 && (
            <>
              <Num>{overdue}</Num> إيصال تجاوز مهلة الإرسال (24 ساعة من
              إصداره) وقد ترفضه المنظومة.{" "}
            </>
          )}
          {late > 0 && (
            <>
              <Num>{late}</Num> إيصال لم يصل بعد ويقترب من مهلة الـ 24 ساعة.
              تأكد من الإنترنت ثم «إرسال الآن».
            </>
          )}
        </p>
      )}

      {alerts.map(([id, s]) => (
        <div
          key={id}
          role="alert"
          className="flex flex-wrap items-center gap-2 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
        >
          <p className="min-w-0 flex-1">
            «{names.get(id) ?? id}»:{" "}
            {s.auth_error
              ? `الإرسال موقوف لفشل المصادقة (${s.auth_error}). راجع بيانات الجهاز ثم «اختبار الاتصال».`
              : s.held_by
                ? `الإرسال متوقف عند المرتجع ${s.held_by} لأن فاتورته الأصلية رفضتها المنظومة، وإيصالات الجهاز بعده تنتظر.`
                : `إعادة المحاولة تلقائياً بعد ${s.wait_seconds} ثانية.`}
          </p>
          {s.held_return_id && !s.auth_error && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={release.isPending}
              onClick={() => release.mutate(s.held_return_id!)}
            >
              إرسال المرتجع رغم ذلك
            </Button>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          الإرسال تلقائي كل دقيقة على البيئة{" "}
          {config.data.environment === "prod" ? "الفعلية" : "التجريبية"}، والمرفوض
          لا يُعاد تلقائياً.
        </p>
        <Button
          type="button"
          className="gap-2"
          disabled={!config.data.enabled || send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconSend className="size-4" />
          )}
          إرسال الآن
        </Button>
      </div>

      {(attempts.data?.length ?? 0) > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-120 text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b text-start">
                <th className="py-1.5 text-start font-normal">الوقت</th>
                <th className="text-start font-normal">العملية</th>
                <th className="text-start font-normal">النتيجة</th>
                <th className="text-start font-normal">إيصالات</th>
                <th className="text-start font-normal">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {attempts.data!.map((a) => (
                <tr key={a.id} className="border-b last:border-0 align-top">
                  <td className="py-1.5 whitespace-nowrap">
                    {formatDateTime(toMs(a.created_at))}
                  </td>
                  <td>{OPERATION[a.operation] ?? a.operation}</td>
                  <td
                    className={cn(
                      a.outcome === "ok" ? "text-success" : "text-destructive",
                      a.outcome === "partial" && "text-warning",
                    )}
                  >
                    {OUTCOME[a.outcome] ?? a.outcome}
                    {a.http_status ? ` (${a.http_status})` : ""}
                  </td>
                  <td>
                    {a.receipts_count > 0 && (
                      <>
                        <Num>{a.accepted_count}</Num>/<Num>{a.receipts_count}</Num>
                      </>
                    )}
                  </td>
                  <td className="max-w-64 wrap-break-word text-muted-foreground">
                    {a.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
