"use client";

import type { AuditDetail } from "../types/auditLog";

/** التفاصيل جاهزة بالعربي من الـ backend: «الحقل: قبل ← بعد» أو «الحقل: قيمة». */
export function AuditChanges({ details }: { details: AuditDetail[] }) {
  if (details.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        لا توجد تفاصيل إضافية.
      </p>
    );
  }

  return (
    <dl className="grid gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-[auto_1fr]">
      {details.map((d, i) => (
        <div key={`${d.label}-${i}`} className="contents">
          <dt className="text-muted-foreground">{d.label}</dt>
          <dd className="min-w-0 wrap-break-word">
            {d.before !== null ? (
              <>
                <bdi className="text-destructive line-through">{d.before}</bdi>{" "}
                ← <bdi className="text-success">{d.after}</bdi>
              </>
            ) : (
              <bdi>{d.after}</bdi>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
