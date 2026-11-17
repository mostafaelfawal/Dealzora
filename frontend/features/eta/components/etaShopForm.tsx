"use client";

import { IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { FormField } from "@/components/shared/form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useEtaBranch,
  useEtaConfig,
  useSaveEtaBranch,
  useSaveEtaConfig,
} from "../hooks/useEta";
import type { EtaBranch, EtaConfig } from "../types/eta";
import { EtaCodeSelect, orNull } from "./etaCodeSelect";
import { EtaEnvironmentSwitch } from "./etaEnvironment";

function SaveBar({ changed, pending }: { changed: boolean; pending: boolean }) {
  return (
    <div className="flex justify-end border-t pt-3">
      <Button
        type="submit"
        size="lg"
        disabled={!changed || pending}
        className="h-10 gap-2"
      >
        {pending ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconDeviceFloppy className="size-4" />
        )}
        حفظ
      </Button>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  max,
  hint,
  ltr,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  max: number;
  hint?: ReactNode;
  ltr?: boolean;
}) {
  return (
    <FormField id={id} label={label} hint={hint}>
      <Input
        id={id}
        value={value}
        maxLength={max}
        dir={ltr ? "ltr" : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-10"
      />
    </FormField>
  );
}

/* ---------- بيانات المحل (seller) ---------- */

type ShopDraft = Record<"rin" | "tradeName" | "activity", string>;

const shopDraft = (c: EtaConfig): ShopDraft => ({
  rin: c.rin ?? "",
  tradeName: c.company_trade_name ?? "",
  activity: c.activity_code ?? "",
});

/**
 * رقم التسجيل والاسم التجاري وكود النشاط. التفعيل من قسم «الجاهزية»، والبيئة (تجريبية/فعلية) بزر
 * مستقل بتأكيد صريح لأنها تبدأ سلسلة جديدة وتُغلق المعلّق.
 */
export function EtaShopForm() {
  const { data } = useEtaConfig();
  const save = useSaveEtaConfig();
  const [draft, setDraft] = useState<ShopDraft | null>(null);
  if (!data) return <Skeleton className="h-40 w-full" />;
  const d = draft ?? shopDraft(data);
  const patch = (p: Partial<ShopDraft>) => setDraft({ ...d, ...p });
  const next: EtaConfig = {
    ...data,
    rin: orNull(d.rin),
    company_trade_name: orNull(d.tradeName),
    activity_code: orNull(d.activity),
  };
  const changed = JSON.stringify(next) !== JSON.stringify(data);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (changed) save.mutate(next, { onSuccess: () => setDraft(null) });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="eta-rin"
          label="رقم التسجيل الضريبي (RIN)"
          value={d.rin}
          onChange={(rin) => patch({ rin })}
          max={30}
          ltr
        />
        <TextField
          id="eta-trade-name"
          label="الاسم التجاري المسجّل"
          value={d.tradeName}
          onChange={(tradeName) => patch({ tradeName })}
          max={200}
          hint="كما هو مسجّل في المصلحة"
        />
        <FormField id="eta-activity" label="كود النشاط">
          <EtaCodeSelect
            id="eta-activity"
            table="activities"
            value={orNull(d.activity)}
            onChange={(activity) => patch({ activity: activity ?? "" })}
            placeholder="اختر نشاط المحل"
          />
        </FormField>
      </div>
      <EtaEnvironmentSwitch current={data.environment} />
      {data.enabled && (
        <p className="text-xs text-muted-foreground">
          المنظومة مفعّلة: الحفظ يُفحص بالقيم الجديدة، ويُرفض لو نقص بند مطلوب.
        </p>
      )}
      <SaveBar changed={changed} pending={save.isPending} />
    </form>
  );
}

/* ---------- الفرع (branchCode + branchAddress) ---------- */

type BranchKey = Exclude<keyof EtaBranch, "country">;

/** الحقول بترتيب الـ SDK. الإلزامية فيه: الكود والمحافظة والمدينة والشارع ورقم المبنى. */
const BRANCH_FIELDS: {
  key: BranchKey;
  label: string;
  max: number;
  required?: boolean;
  ltr?: boolean;
  hint?: string;
}[] = [
  {
    key: "branch_code",
    label: "كود الفرع في المنظومة",
    max: 50,
    required: true,
    ltr: true,
    hint: "من ملف الممول على بوابة المنظومة",
  },
  { key: "governate", label: "المحافظة", max: 100, required: true },
  { key: "region_city", label: "المدينة / المنطقة", max: 100, required: true },
  { key: "street", label: "الشارع", max: 200, required: true },
  { key: "building_number", label: "رقم المبنى", max: 100, required: true },
  { key: "postal_code", label: "الرمز البريدي", max: 30, ltr: true },
  { key: "floor", label: "الدور", max: 100 },
  { key: "room", label: "رقم المحل / الغرفة", max: 100 },
  { key: "landmark", label: "علامة مميزة", max: 500 },
  { key: "additional_information", label: "معلومات إضافية", max: 500 },
];

const branchDraft = (b: EtaBranch) =>
  Object.fromEntries(
    BRANCH_FIELDS.map((f) => [f.key, b[f.key] ?? ""]),
  ) as Record<BranchKey, string>;

/** بيانات هذا الفرع (كل جهاز أساسي = فرع بقاعدته). الدولة EG دائماً للممول المصري. */
export function EtaBranchForm() {
  const { data } = useEtaBranch();
  const save = useSaveEtaBranch();
  const [draft, setDraft] = useState<Record<BranchKey, string> | null>(null);
  if (!data) return <Skeleton className="h-56 w-full" />;
  const d = draft ?? branchDraft(data);
  const next: EtaBranch = {
    ...data,
    ...(Object.fromEntries(
      BRANCH_FIELDS.map((f) => [f.key, orNull(d[f.key])]),
    ) as Record<BranchKey, string | null>),
  };
  const changed = JSON.stringify(next) !== JSON.stringify(data);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (changed) save.mutate(next, { onSuccess: () => setDraft(null) });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {BRANCH_FIELDS.map((f) => (
          <TextField
            key={f.key}
            id={`eta-branch-${f.key}`}
            label={f.required ? `${f.label} *` : f.label}
            value={d[f.key]}
            onChange={(v) => setDraft({ ...d, [f.key]: v })}
            max={f.max}
            hint={f.hint}
            ltr={f.ltr}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        الدولة: مصر (EG). * إلزامي في المنظومة.
      </p>
      <SaveBar changed={changed} pending={save.isPending} />
    </form>
  );
}
