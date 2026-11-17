"use client";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { cn } from "@/lib/utils";

import { REPORT_GROUPS, type ReportTabOption } from "../config/reportOptions";
import type { ReportTab } from "../types/report";

/**
 * قائمة التقارير مجمّعة بالسؤال: «البيع»، «البضاعة»، «العملاء والموظفون»، «الأموال».
 * كل تقرير بأيقونة وسطر يوضّح السؤال الذي يجيب عنه، فيجد التاجر ما يحتاجه دون تجربة.
 * على الشاشات الصغيرة: قائمة منسدلة واحدة بدل صف أزرار طويل.
 */
export function ReportNav({
  tabs,
  value,
  onChange,
}: {
  tabs: ReportTabOption[];
  value: ReportTab;
  onChange: (tab: ReportTab) => void;
}) {
  return (
    <>
      <OptionSelect
        label="التقرير"
        items={tabs.map((t) => ({ value: t.id, label: t.label }))}
        value={value}
        onChange={onChange}
        className="w-full lg:hidden"
      />

      <nav
        aria-label="التقارير"
        className="hidden space-y-4 border bg-card p-2 lg:block"
      >
        {REPORT_GROUPS.map((g) => {
          const items = tabs.filter((t) => t.group === g.id);
          if (!items.length) return null;
          return (
            <div key={g.id} className="space-y-0.5">
              <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
                {g.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((t) => {
                  const active = t.id === value;
                  const Icon = t.icon;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        aria-current={active ? "page" : undefined}
                        onClick={() => onChange(t.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 border-s-2 px-2 py-2 text-start outline-none transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-primary/40",
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon
                          aria-hidden
                          className={cn(
                            "size-4 shrink-0",
                            active && "text-primary",
                          )}
                        />
                        <span className="min-w-0">
                          <span
                            className={cn(
                              "block truncate text-xs",
                              active && "font-semibold",
                            )}
                          >
                            {t.label}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {t.hint}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </>
  );
}
