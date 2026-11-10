"use client";

import { IconDeviceFloppy } from "@tabler/icons-react";
import Link from "next/link";

import { SavingLabel } from "@/components/shared/form";
import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import { PRODUCT_FORM_SHORTCUTS } from "../config/productShortcuts";

export type SaveAction = "save" | "saveAndNew";

/** شريط الحفظ اللاصق أسفل النموذج. */
export function ProductFormFooter({
  isEditing,
  isSaving,
  pendingAction,
  onSaveAndNew,
}: {
  isEditing: boolean;
  isSaving: boolean;
  pendingAction: SaveAction;
  onSaveAndNew: () => void;
}) {
  const savingNew = isSaving && pendingAction === "saveAndNew";
  const saving = isSaving && pendingAction === "save";

  return (
    <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isSaving}
        nativeButton={false}
        render={<Link href={PRODUCT_ROUTES.list} />}
        className="font-normal sm:me-auto"
      >
        إلغاء
      </Button>

      {!isEditing && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isSaving}
          aria-busy={savingNew}
          onClick={onSaveAndNew}
          className="gap-2 font-normal"
        >
          {savingNew ? (
            <SavingLabel />
          ) : (
            <>
              حفظ وإضافة آخر
              <ShortcutBadge className="hidden lg:inline-flex">
                {PRODUCT_FORM_SHORTCUTS.saveAndNew.label}
              </ShortcutBadge>
            </>
          )}
        </Button>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isSaving}
        aria-busy={saving}
        className="gap-2 px-5"
      >
        {saving ? (
          <SavingLabel />
        ) : (
          <>
            <IconDeviceFloppy className="size-4" aria-hidden />
            {isEditing ? "حفظ التعديلات" : "حفظ الصنف"}
            <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
              {PRODUCT_FORM_SHORTCUTS.save.label}
            </ShortcutBadge>
          </>
        )}
      </Button>
    </div>
  );
}
