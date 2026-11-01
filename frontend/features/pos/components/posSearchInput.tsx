"use client";

import { IconAlertTriangle, IconSearch, IconX } from "@tabler/icons-react";
import type { KeyboardEvent, RefObject } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import { formatQty } from "../lib/posCalc";

interface PosSearchInputProps {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  expanded: boolean;
  activeOptionId?: string;
  notFound: string | null;
  /** الكمية المكتوبة بصيغة 3*باركود. */
  pendingQty: number | null;
}

/** خانة الباركود والبحث: عليها التركيز دائماً، وتفهم صيغة 3*باركود. */
export function PosSearchInput({
  inputRef,
  value,
  onChange,
  onKeyDown,
  expanded,
  activeOptionId,
  notFound,
  pendingQty,
}: PosSearchInputProps) {
  return (
    <div className="space-y-1.5">
      <InputGroup className="h-11">
        <InputGroupAddon>
          <IconSearch className="mr-2 size-5" />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-label="باركود أو اسم الصنف"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls="pos-results"
          aria-activedescendant={activeOptionId}
          aria-invalid={notFound ? true : undefined}
          placeholder="امسح الباركود أو اكتب اسم الصنف…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-full text-sm md:text-sm"
        />
        <InputGroupAddon align="inline-end">
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="ml-2"
              aria-label="مسح الخانة"
              onClick={() => onChange("")}
            >
              <IconX />
            </Button>
          ) : (
            <ShortcutBadge className="hidden rounded-none ml-2 lg:inline-flex">
              {POS_SHORTCUTS.focusSearch.label}
            </ShortcutBadge>
          )}
        </InputGroupAddon>
      </InputGroup>

      <p
        aria-live="polite"
        className="flex min-h-4 items-center gap-1.5 truncate text-xs"
      >
        {notFound ? (
          <span className="flex items-center gap-1.5 text-destructive">
            <IconAlertTriangle className="size-3.5 shrink-0" />
            {notFound}
          </span>
        ) : pendingQty !== null ? (
          <span>
            الكمية:{" "}
            <span dir="ltr" className="font-mono tabular-nums">
              {formatQty(pendingQty)}
            </span>{" "}
            · ثم اكتب الباركود أو الاسم
          </span>
        ) : (
          <span className="text-muted-foreground">
            Enter للإضافة · Enter على خانة فارغة = دفع · 3*باركود لتحديد الكمية
          </span>
        )}
      </p>
    </div>
  );
}
