"use client";

import { IconAlertTriangle, IconSearch, IconX } from "@tabler/icons-react";
import type { KeyboardEvent } from "react";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { formatQty } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { POS_SHORTCUTS } from "../config/posShortcuts";
import { registerSearchInput } from "../lib/posFocus";
import { handleSearchKey } from "../store/posActions";
import { posUiActions } from "../store/posUiSlice";
import {
  selectEntry,
  selectIsSearching,
  selectQuery,
  selectSafeIndex,
  selectSearchResults,
} from "../store/selectors";
import { posOptionId } from "./posSearchResults";

/** خانة الباركود والبحث: عليها التركيز دائماً، وتفهم صيغة 3*باركود. */
export function PosSearchInput() {
  const dispatch = useAppDispatch();
  const value = useAppSelector(selectQuery);
  const notFound = useAppSelector((s) => s.posUi.notFound);
  /** الكمية المكتوبة بصيغة 3*باركود. */
  const pendingQty = useAppSelector((s) => selectEntry(s).qty);
  const searching = useAppSelector(selectIsSearching);
  const results = useAppSelector(selectSearchResults);
  const activeProduct = results[useAppSelector(selectSafeIndex)];

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (dispatch(handleSearchKey(event.key))) event.preventDefault();
  }

  return (
    <div className="space-y-1.5">
      <InputGroup className="h-11">
        <InputGroupAddon>
          <IconSearch className="mr-2 size-5" />
        </InputGroupAddon>
        <InputGroupInput
          ref={registerSearchInput}
          value={value}
          onChange={(event) =>
            dispatch(posUiActions.setQuery(event.target.value))
          }
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-label="باركود أو اسم الصنف"
          aria-autocomplete="list"
          aria-expanded={searching && results.length > 0}
          aria-controls="pos-results"
          aria-activedescendant={
            searching && activeProduct
              ? posOptionId(activeProduct.id)
              : undefined
          }
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
              onClick={() => dispatch(posUiActions.setQuery(""))}
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
