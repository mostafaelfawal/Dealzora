"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ChartCard } from "@/components/shared/charts/ChartCard";
import { Money } from "@/components/shared/Money";
import { cn } from "@/lib/utils";

import type { Health } from "../types/dashboard";

type Tone = "bad" | "warn";

interface HealthRow {
  label: string;
  value: ReactNode;
  tone?: Tone;
  href: string;
}

const DOT_CLASS: Record<Tone, string> = {
  bad: "bg-destructive",
  warn: "bg-warning",
};

const VALUE_CLASS: Record<Tone, string> = {
  bad: "text-destructive",
  warn: "text-warning",
};

const money = (amount: number, className?: string) => (
  <Money amount={amount} className={cn("text-xs", className)} />
);

/** يحوّل أرقام الصحة إلى صفوف قابلة للنقر، كل صف يقود لشاشته. */
function healthRows(h: Health): HealthRow[] {
  return [
    {
      label: "قيمة المخزون",
      value: money(h.stockValue),
      href: "/admin/inventory",
    },
    {
      label: "أصناف نفدت",
      value: h.outOfStock,
      tone: h.outOfStock ? "bad" : undefined,
      href: "/admin/inventory",
    },
    {
      label: "قاربت على النفاد",
      value: h.lowStock,
      tone: h.lowStock ? "warn" : undefined,
      href: "/admin/inventory",
    },
    {
      label: `راكد (${h.stagnantCount} صنف)`,
      value: money(h.stagnantValue),
      tone: h.stagnantValue ? "warn" : undefined,
      href: "/admin/inventory",
    },
    {
      label: "ديون العملاء",
      value: money(h.customersDebt),
      href: "/admin/customers",
    },
    {
      label: `متأخرة (${h.overdueCustomers} عميل)`,
      value: money(h.overdueDebt),
      tone: h.overdueDebt ? "bad" : undefined,
      href: "/admin/reports",
    },
    {
      label: "مستحق للموردين",
      value: money(h.suppliersPayable),
      href: "/admin/suppliers",
    },
    {
      label: "رصيد الخزنة الآن",
      value: money(
        h.treasuryBalance,
        h.treasuryBalance < 0 ? "text-destructive" : undefined,
      ),
      href: "/admin/treasury",
    },
  ];
}

export function DashboardHealth({ health }: { health: Health }) {
  return (
    <ChartCard
      index={10}
      title="صحة النشاط الآن"
      subtitle="المخزون والديون والخزنة (لا تتأثر بالفترة)"
    >
      <ul className="divide-y text-xs">
        {healthRows(health).map((row) => (
          <li key={row.label}>
            <Link
              href={row.href}
              className="flex items-center justify-between gap-3 py-2 hover:bg-muted/40"
            >
              <span className="flex items-center gap-2">
                {row.tone && (
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full", DOT_CLASS[row.tone])}
                  />
                )}
                {row.label}
              </span>
              <span
                className={cn(
                  "font-mono font-semibold",
                  row.tone && VALUE_CLASS[row.tone],
                )}
              >
                {row.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
