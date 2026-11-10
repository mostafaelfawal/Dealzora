"use client";

import {
  IconCheck,
  IconLoader2,
  IconPencil,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Esc داخل الحقل يلغي التعديل فقط ولا يغلق النافذة. */
const stopEscape = (onCancel: () => void) => (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  onCancel();
};

/** حقل إضافة عنصر جديد أعلى القائمة. Enter = إضافة. */
export function CatalogAddRow({
  placeholder,
  maxLength,
  pending,
  extra,
  onAdd,
}: {
  placeholder: string;
  maxLength: number;
  pending: boolean;
  /** عناصر إضافية بجانب الحقل (مفتاح "بالوزن" للوحدات). */
  extra?: ReactNode;
  onAdd: (name: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const clean = name.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation(); // النافذة قد تكون داخل فورم الصنف (أحداث الـ portal تصعد في React)
    if (!clean || pending) return;
    try {
      await onAdd(clean);
      setName("");
    } catch {
      // الخطأ يظهر كـ toast، ونترك النص ليصححه المستخدم.
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={stopEscape(() => setName(""))}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        className="h-10 min-w-40 flex-1"
      />
      {extra}
      <Button
        type="submit"
        size="lg"
        disabled={!clean || pending}
        className="h-10 gap-1.5"
      >
        {pending ? (
          <IconLoader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <IconPlus className="size-4" aria-hidden />
        )}
        إضافة
      </Button>
    </form>
  );
}

/** صف قابل لإعادة التسمية والحذف (مع تأكيد). */
export function CatalogRow({
  name,
  meta,
  extra,
  maxLength,
  pending,
  deleteBlockedReason,
  deleteWarning,
  onRename,
  onDelete,
}: {
  name: string;
  meta: ReactNode;
  extra?: ReactNode;
  maxLength: number;
  pending: boolean;
  /** لو موجود: زر الحذف معطّل وهذا سببه. */
  deleteBlockedReason?: string;
  /** تنبيه يظهر في خطوة تأكيد الحذف. */
  deleteWarning?: string;
  onRename: (name: string) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [draft, setDraft] = useState(name);
  const clean = draft.trim();

  const startEdit = () => {
    setDraft(name);
    setMode("edit");
  };

  async function saveName(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!clean || pending) return;
    if (clean === name) return setMode("view");
    try {
      await onRename(clean);
      setMode("view");
    } catch {}
  }

  async function confirmDelete() {
    try {
      await onDelete();
    } catch {
      setMode("view");
    }
  }

  if (mode === "edit") {
    return (
      <li className="border-b last:border-b-0">
        <form onSubmit={saveName} className="flex items-center gap-2 py-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={stopEscape(() => setMode("view"))}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`الاسم الجديد لـ ${name}`}
            maxLength={maxLength}
            autoComplete="off"
            autoFocus
            className="h-9 flex-1"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!clean || pending}
            aria-label="حفظ الاسم"
          >
            {pending ? <IconLoader2 className="animate-spin" /> : <IconCheck />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="إلغاء"
            onClick={() => setMode("view")}
          >
            <IconX />
          </Button>
        </form>
      </li>
    );
  }

  if (mode === "confirm") {
    return (
      <li className="border-b bg-destructive/5 last:border-b-0">
        <div className="flex flex-wrap items-center gap-2 px-2 py-2">
          <div className="min-w-0 flex-1 text-sm">
            <p>
              حذف <b>«{name}»</b>؟
            </p>
            {deleteWarning && (
              <p className="text-xs text-muted-foreground">{deleteWarning}</p>
            )}
          </div>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={confirmDelete}
            className="gap-1.5"
            autoFocus
          >
            {pending && <IconLoader2 className="size-3.5 animate-spin" />}
            تأكيد الحذف
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setMode("view")}
          >
            إلغاء
          </Button>
        </div>
      </li>
    );
  }

  const deleteButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`حذف ${name}`}
      disabled={Boolean(deleteBlockedReason)}
      onClick={() => setMode("confirm")}
      className="text-destructive"
    >
      <IconTrash />
    </Button>
  );

  return (
    <li className="group flex items-center gap-2 border-b py-1.5 last:border-b-0">
      <button
        type="button"
        onClick={startEdit}
        className={cn(
          "min-w-0 flex-1 truncate rounded-sm px-1 py-1 text-start text-sm outline-none",
          "hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
        title="اضغط لإعادة التسمية"
      >
        {name}
      </button>
      <span className="shrink-0 text-[11px] text-muted-foreground">{meta}</span>
      {extra}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`إعادة تسمية ${name}`}
        onClick={startEdit}
      >
        <IconPencil />
      </Button>
      {deleteBlockedReason ? (
        <AppTooltip message={deleteBlockedReason}>
          <span>{deleteButton}</span>
        </AppTooltip>
      ) : (
        deleteButton
      )}
    </li>
  );
}
