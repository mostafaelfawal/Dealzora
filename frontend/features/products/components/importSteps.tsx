"use client";

import { IconCheck } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import { IMPORT_STEPS, type ImportStep } from "../config/importOptions";

/** مؤشر خطوات الاستيراد أعلى النافذة. */
export function ImportSteps({ current }: { current: ImportStep }) {
  const currentIndex = IMPORT_STEPS.findIndex((s) => s.id === current);

  return (
    <ol
      aria-label="خطوات الاستيراد"
      className="flex items-center gap-2 text-xs"
    >
      {IMPORT_STEPS.map((step, index) => {
        const active = index === currentIndex;
        const done = !active && (index < currentIndex || current === "done");
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "flex size-5 items-center justify-center border font-mono text-[11px] tabular-nums",
                active && "border-primary bg-primary text-primary-foreground",
                done && "border-primary text-primary",
              )}
            >
              {done ? <IconCheck className="size-3" /> : index + 1}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>
              {step.label}
            </span>
            {index < IMPORT_STEPS.length - 1 && (
              <span aria-hidden className="h-px w-6 bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
