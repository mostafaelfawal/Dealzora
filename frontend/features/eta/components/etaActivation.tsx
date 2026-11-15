"use client";

import {
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleDashed,
  IconLoader2,
} from "@tabler/icons-react";

import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  useAdoptChainAnchor,
  useEtaConfig,
  useEtaReadiness,
  useSaveEtaConfig,
} from "../hooks/useEta";
import type { ReadinessItem, ReadinessSection } from "../types/eta";

/** أين يُستكمل كل بند (مرساة القسم في نفس الصفحة أو صفحة أخرى). */
const FIX_LINK: Record<ReadinessSection, { href: string; label: string }> = {
  tax: { href: "#tax", label: "إعداد الضريبة" },
  shop: { href: "#eta-shop", label: "بيانات المحل" },
  branch: { href: "#eta-branch", label: "بيانات الفرع" },
  devices: { href: "#eta-devices", label: "الأجهزة" },
  units: { href: "#eta-units", label: "وحدات القياس" },
  products: { href: "/admin/products", label: "الأصناف" },
};

function Item({ item }: { item: ReadinessItem }) {
  const blocker = item.severity === "blocker";
  const link = FIX_LINK[item.section];
  const adopt = useAdoptChainAnchor();
  // فجوة سلسلة بعد استعادة نسخة قديمة: قرار صريح من المدير بدل رابط.
  const chainGap = item.key.startsWith("chain.") && item.ref_id;
  return (
    <li className="flex items-start gap-2.5 py-2">
      {blocker ? (
        <IconCircleDashed className="mt-0.5 size-4 shrink-0 text-destructive" />
      ) : (
        <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
      )}
      <div className="min-w-0 flex-1 space-y-0.5 text-sm">
        <p className="font-medium">
          {item.title}
          {item.count != null && item.count > 1 && (
            <span className="ms-1 text-muted-foreground">
              (<Num>{item.count}</Num>)
            </span>
          )}
        </p>
        {item.detail && (
          <p className="text-xs text-muted-foreground">{item.detail}</p>
        )}
        {item.samples.length > 0 && (
          <p className="text-xs wrap-break-word text-muted-foreground">
            {item.samples.join("، ")}
            {item.count != null && item.count > item.samples.length && " …"}
          </p>
        )}
      </div>
      {chainGap ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          disabled={adopt.isPending}
          onClick={() => adopt.mutate(item.ref_id!)}
        >
          متابعة السلسلة من آخر إيصال صادر
        </Button>
      ) : (
        <a
          href={link.href}
          className="shrink-0 text-xs text-primary underline-offset-4 hover:underline"
        >
          {link.label}
        </a>
      )}
    </li>
  );
}

/** التفعيل + قائمة مهام الجاهزية: لا يُفعَّل والقائمة فيها بند مانع (والسيرفر يرفض أيضاً). */
export function EtaActivation() {
  const config = useEtaConfig();
  const readiness = useEtaReadiness();
  const save = useSaveEtaConfig();

  if (!config.data || !readiness.data) {
    return <Skeleton className="h-32 w-full" />;
  }
  const cfg = config.data;
  const r = readiness.data;
  const canEnable = r.ready || cfg.enabled;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="eta-enabled" className="flex-1">
          تفعيل الإيصال الإلكتروني
          <span className="block text-xs font-normal text-muted-foreground">
            {cfg.enabled
              ? `مفعّل · البيئة ${cfg.environment === "prod" ? "الفعلية" : "التجريبية"}`
              : r.ready
                ? "كل البيانات جاهزة"
                : "يُتاح بعد استكمال البنود أدناه"}
          </span>
        </Label>
        {save.isPending ? (
          <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            id="eta-enabled"
            checked={cfg.enabled}
            disabled={!canEnable}
            onCheckedChange={(enabled) => save.mutate({ ...cfg, enabled })}
          />
        )}
      </div>

      <div
        className={cn(
          "flex items-center gap-2 border px-3 py-2 text-sm",
          r.ready
            ? "border-success/40 bg-success/5 text-success"
            : "border-destructive/30 bg-destructive/5",
        )}
        role="status"
      >
        {r.ready ? (
          <>
            <IconCircleCheck className="size-4" /> جاهز للتفعيل
            {r.warnings > 0 && (
              <span className="text-muted-foreground">
                · <Num>{r.warnings}</Num> تنبيه
              </span>
            )}
          </>
        ) : (
          <>
            ينقص <Num>{r.blockers}</Num> بند قبل التفعيل
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ms-auto h-7"
          onClick={() => void readiness.refetch()}
          disabled={readiness.isFetching}
        >
          {readiness.isFetching ? "جارٍ الفحص…" : "إعادة الفحص"}
        </Button>
      </div>

      {r.items.length > 0 && (
        <ul className="divide-y">
          {r.items.map((item) => (
            <Item key={item.key} item={item} />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        الإيصالات تتولد وتُحفظ مع كل بيع، ولا يُرسل أي شيء للمنظومة بعد.
      </p>
    </div>
  );
}
