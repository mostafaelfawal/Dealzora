"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { extractErrorMessage } from "@/lib/errors";

/** أنماط الجداول المشتركة بين كل التقارير. */
export const reportTh =
  "h-9 px-3 text-start text-xs font-medium whitespace-nowrap text-muted-foreground";
export const reportTd = "h-10 px-3 text-xs tabular-nums";
/** صف جدول: خلفية عند المرور تساعد العين تتبع السطر لآخره. */
export const reportTr =
  "border-b transition-colors last:border-0 hover:bg-muted/40";

export function ReportPanel({
  title,
  children,
  action,
  count,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  /** عدد الصفوف بجانب العنوان. */
  count?: number;
}) {
  return (
    <section className="space-y-3 border bg-card p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {count !== undefined && count > 0 && (
            <span className="bg-muted px-1.5 py-0.5 font-mono text-[10px] font-normal text-muted-foreground tabular-nums">
              {count}
            </span>
          )}
        </h2>
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
    <thead className="border-b bg-muted/50">
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

export interface ReportColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** جدول تقرير بسيط داخل لوحة: عنوان، أعمدة، صفوف، ورسالة لو فارغ. */
export function ReportTable<T>({
  title,
  rows,
  columns,
  getKey,
  empty,
  action,
  minWidth = "min-w-130",
}: {
  title: string;
  rows: T[];
  columns: ReportColumn<T>[];
  getKey: (row: T) => string;
  empty: string;
  action?: ReactNode;
  minWidth?: string;
}) {
  return (
    <ReportPanel title={title} action={action} count={rows.length}>
      {rows.length === 0 ? (
        <p className="border border-dashed py-6 text-center text-xs text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full ${minWidth}`}>
            <ReportTableHead columns={columns.map((c) => c.header)} />
            <tbody>
              {rows.map((row) => (
                <tr key={getKey(row)} className={reportTr}>
                  {columns.map((c) => (
                    <td
                      key={c.header}
                      className={`${reportTd} ${c.className ?? ""}`}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportPanel>
  );
}
