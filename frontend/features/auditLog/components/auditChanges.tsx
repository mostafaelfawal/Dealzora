"use client";

import { asDiff, formatChangeValue } from "../lib/auditChanges";
import type { AuditChanges as AuditChangesMap } from "../types/auditLog";

/** التغييرات: {حقل: {from, to}} تُعرض "قبل ← بعد"، وغيرها قيمة واحدة. */
export function AuditChanges({ changes }: { changes: AuditChangesMap | null }) {
  if (!changes || Object.keys(changes).length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <dl className="grid gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-[auto_1fr]">
      {Object.entries(changes).map(([key, value]) => {
        const diff = asDiff(value);
        return (
          <div key={key} className="contents">
            <dt className="font-mono text-muted-foreground">{key}</dt>
            <dd className="min-w-0 wrap-break-word">
              {diff ? (
                <>
                  <span className="text-destructive line-through">
                    {formatChangeValue(diff.from)}
                  </span>{" "}
                  ←{" "}
                  <span className="text-success">
                    {formatChangeValue(diff.to)}
                  </span>
                </>
              ) : (
                formatChangeValue(value)
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
