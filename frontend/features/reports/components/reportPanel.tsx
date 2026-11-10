"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { extractErrorMessage } from "@/lib/errors";

/** أنماط الجداول المشتركة بين كل التقارير. */
export const reportTh =
  "h-9 px-3 text-start text-xs font-normal text-muted-foreground";
export const reportTd = "h-10 px-3 text-xs";

export function ReportPanel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-3 border bg-card p-3">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** هيكل التحميل، أو رسالة الخطأ مع إعادة المحاولة. */
export function ReportLoading({
  error,
  onRetry,
}: {
  error?: unknown;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 border border-dashed py-12 text-center">
        <p role="alert" className="text-sm text-destructive">
          {extractErrorMessage(error, "تعذّر تحميل التقرير")}
        </p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            إعادة المحاولة
          </Button>
        )}
      </div>
    );
  }
  return (
    <div aria-busy className="space-y-2">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function ReportTableHead({ columns }: { columns: string[] }) {
  return (
    <thead className="border-b">
      <tr>
        {columns.map((col) => (
          <th key={col} className={reportTh}>
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** نص "لا يوجد" داخل قائمة. */
export function ReportListEmpty({ text }: { text: string }) {
  return (
    <li className="py-6 text-center text-xs text-muted-foreground">{text}</li>
  );
}
