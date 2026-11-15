"use client";

import {
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";

import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { normalizeDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useEtaCodes } from "../hooks/useEta";
import type { CodeTableName, EtaCode } from "../types/eta";

/** عدد الأكواد المعروضة في الصفحة: الجدول كله (مئات الأكواد) لا يُرسم دفعة واحدة على الأجهزة الضعيفة. */
const PAGE_SIZE = 20;

const normalize = (text: string) =>
  normalizeDigits(text)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();

const label = (c: EtaCode) => c.desc_ar || c.desc_en;

/** "" ← null (الحقول الفارغة تُرسل null). */
export const orNull = (text: string) => text.trim() || null;

/** بحث: الكود يبدأ بالنص أولاً، ثم الوصف (عربي/إنجليزي) يحتوي كل الكلمات. */
function search(codes: EtaCode[], query: string): EtaCode[] {
  const q = normalize(query);
  if (!q) return codes;
  const tokens = q.split(/\s+/);
  const byCode: EtaCode[] = [];
  const byText: EtaCode[] = [];
  for (const c of codes) {
    if (normalize(c.code).startsWith(q)) byCode.push(c);
    else {
      const text = normalize(`${c.desc_ar} ${c.desc_en}`);
      if (tokens.every((t) => text.includes(t))) byText.push(c);
    }
  }
  return [...byCode, ...byText];
}

/**
 * اختيار كود من جداول المنظومة: قائمة منسدلة ببحث وتقسيم صفحات (PAGE_SIZE لكل صفحة).
 * الجدول يُجلب مرة واحدة ويُخزَّن، والرسم صفحة صفحة فقط وفقط عند فتح القائمة.
 */
export function EtaCodeSelect({
  id,
  table,
  value,
  onChange,
  placeholder = "اختر كوداً",
  invalid,
  className,
}: {
  id: string;
  table: CodeTableName;
  value: string | null;
  onChange: (code: string | null) => void;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  const { data: codes = [], isLoading } = useEtaCodes(table);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const results = useMemo(
    () => (open ? search(codes, query) : []),
    [codes, query, open],
  );
  const pages = Math.max(Math.ceil(results.length / PAGE_SIZE), 1);
  const current = Math.min(page, pages - 1);
  const visible = results.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const selected = value ? codes.find((c) => c.code === value) : undefined;

  function openChange(next: boolean) {
    setOpen(next);
    if (next) {
      // نفتح على صفحة الكود المختار لو موجود.
      const index = value ? codes.findIndex((c) => c.code === value) : -1;
      setQuery("");
      setPage(index > 0 ? Math.floor(index / PAGE_SIZE) : 0);
    }
  }

  function pick(code: string | null) {
    onChange(code);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger
        render={
          <button
            id={id}
            type="button"
            data-invalid={invalid || undefined}
            className={cn(
              "flex h-10 w-full items-center gap-2 border bg-transparent px-3 text-start text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring data-invalid:border-destructive",
              className,
            )}
          />
        }
      >
        {value ? (
          <>
            <bdi dir="ltr" className="shrink-0 font-mono">
              {value}
            </bdi>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {selected ? label(selected) : "غير موجود في جدول المنظومة"}
            </span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground">
            {isLoading ? "جارٍ التحميل…" : placeholder}
          </span>
        )}
        <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[min(26rem,90vw)] gap-2 p-2">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && visible[0]) {
                e.preventDefault();
                pick(visible[0].code);
              }
            }}
            placeholder="ابحث بالكود أو الوصف"
            aria-label="بحث في الأكواد"
            className="h-9 ps-8"
          />
        </div>

        <ul role="listbox" aria-label="الأكواد" className="max-h-72 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="py-6 text-center text-muted-foreground">
              لا توجد نتائج
            </li>
          ) : (
            visible.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.code === value}
                  onClick={() => pick(c.code)}
                  className={cn(
                    "flex w-full items-start gap-2 px-2 py-1.5 text-start hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    c.code === value && "bg-primary/5",
                  )}
                >
                  <bdi dir="ltr" className="w-14 shrink-0 font-mono">
                    {c.code}
                  </bdi>
                  <span className="min-w-0 flex-1 leading-relaxed">
                    {label(c)}
                  </span>
                  {c.code === value && (
                    <IconCheck className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center gap-1 border-t pt-2">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="الصفحة السابقة"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <IconChevronRight />
          </Button>
          <span className="text-muted-foreground">
            صفحة <Num>{current + 1}</Num> من <Num>{pages}</Num> ·{" "}
            <Num>{results.length}</Num> كود
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="الصفحة التالية"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            <IconChevronLeft />
          </Button>
          {value && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ms-auto gap-1 text-muted-foreground"
              onClick={() => pick(null)}
            >
              <IconX className="size-3.5" /> إزالة
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
