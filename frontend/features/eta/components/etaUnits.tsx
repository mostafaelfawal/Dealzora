"use client";

import { useState } from "react";

import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useEtaUnits, useSaveEtaUnit } from "../hooks/useEta";
import type { EtaUnit } from "../types/eta";
import { EtaCodeSelect, orNull } from "./etaCodeSelect";

function UnitRow({ unit }: { unit: EtaUnit }) {
  const save = useSaveEtaUnit();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? unit.eta_unit_type ?? "";
  const changed = orNull(value) !== unit.eta_unit_type;

  const commit = (code: string | null) =>
    save.mutate({ id: unit.id, code }, { onSuccess: () => setDraft(null) });

  return (
    <li className="grid items-start gap-2 py-2.5 sm:grid-cols-[10rem_1fr_auto]">
      <div className="pt-2 text-sm">
        <p className="font-medium">{unit.name}</p>
        <p className="text-xs text-muted-foreground">
          {unit.product_count > 0 ? (
            <>
              <Num>{unit.product_count}</Num> صنف نشط
            </>
          ) : (
            "غير مستخدمة"
          )}
        </p>
      </div>
      <EtaCodeSelect
        id={`eta-unit-${unit.id}`}
        table="units"
        value={orNull(value)}
        onChange={(code) => setDraft(code ?? "")}
        placeholder={
          unit.suggested ? `اقتراح: ${unit.suggested}` : "اختر كود الوحدة"
        }
        invalid={!unit.eta_unit_type && unit.product_count > 0 && !changed}
      />
      <div className="flex gap-1.5">
        {!unit.eta_unit_type && unit.suggested && !changed && (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={save.isPending}
            onClick={() => commit(unit.suggested)}
          >
            استخدام {unit.suggested}
          </Button>
        )}
        {changed && (
          <Button
            type="button"
            className="h-10"
            disabled={save.isPending}
            onClick={() => commit(orNull(value))}
          >
            حفظ
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * ربط وحدات البيع الحالية (قطعة، كيلو، كرتونة، دستة…) بأكواد جدول وحدات المنظومة.
 * الربط على اسم الوحدة فيُطبق على كل الأصناف ووحداتها الإضافية مرة واحدة.
 */
export function EtaUnits() {
  const { data } = useEtaUnits();
  if (!data) return <Skeleton className="h-32 w-full" />;
  const sorted = [...data].sort(
    (a, b) =>
      Number(Boolean(a.eta_unit_type)) - Number(Boolean(b.eta_unit_type)) ||
      b.product_count - a.product_count,
  );
  return (
    <div className="space-y-2">
      <ul className="divide-y">
        {sorted.map((u) => (
          <UnitRow key={u.id} unit={u} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        الاقتراحات لأسماء شائعة فقط وتُراجع قبل الحفظ. الأكواد من جدول وحدات
        المنظومة الرسمي (مثل EA للقطعة وKGM للكيلوجرام وCT للكرتونة وDZN للدستة).
      </p>
    </div>
  );
}
