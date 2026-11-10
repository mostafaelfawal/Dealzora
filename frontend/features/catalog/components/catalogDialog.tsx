"use client";

import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import useGetCategories from "@/features/products/hooks/useGetCategories";

import { CATEGORY_NAME_MAX, UNIT_NAME_MAX } from "../config/catalogOptions";
import {
  useCreateCategory,
  useCreateUnit,
  useDeleteCategory,
  useDeleteUnit,
  useRenameCategory,
  useUnits,
  useUpdateUnit,
} from "../hooks/useCatalog";
import type { CatalogTab } from "../types/catalog";
import { CatalogAddRow, CatalogRow } from "./catalogRow";

const itemCount = (n: number) => (n === 0 ? "بدون أصناف" : `${n} صنف`);

/** إدارة الأقسام ووحدات القياس (للمدير). */
export function CatalogDialog({
  open,
  onOpenChange,
  initialTab = "categories",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: CatalogTab;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] gap-3 overflow-y-auto sm:max-w-lg">
        {/* نُركّب المحتوى عند الفتح فقط ليبدأ على التبويب المطلوب. */}
        {open && <CatalogContent initialTab={initialTab} />}
      </DialogContent>
    </Dialog>
  );
}

function CatalogContent({ initialTab }: { initialTab: CatalogTab }) {
  const [tab, setTab] = useState<CatalogTab>(initialTab);
  const categories = useGetCategories();
  const units = useUnits();

  return (
    <>
      <DialogHeader className="text-start">
        <DialogTitle>الأقسام والوحدات</DialogTitle>
        <DialogDescription>
          اضغط على أي اسم لإعادة تسميته. التعديل يظهر على كل الأصناف فوراً.
        </DialogDescription>
      </DialogHeader>
      <SegmentedTabs
        label="نوع القائمة"
        value={tab}
        onChange={setTab}
        items={[
          {
            id: "categories",
            label: "الأقسام",
            count: categories.data?.length,
          },
          { id: "units", label: "الوحدات", count: units.data?.length },
        ]}
      />
      {tab === "categories" ? <CategoriesPanel /> : <UnitsPanel />}
    </>
  );
}

function ListState({
  isPending,
  isError,
  onRetry,
  empty,
}: {
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  empty: string;
}) {
  if (isPending)
    return (
      <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <IconLoader2 className="size-4 animate-spin" /> جارٍ التحميل…
      </p>
    );
  if (isError)
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <p role="alert" className="text-sm text-destructive">
          تعذّر تحميل القائمة
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      </div>
    );
  return (
    <p className="border border-dashed py-8 text-center text-sm text-muted-foreground">
      {empty}
    </p>
  );
}

function CategoriesPanel() {
  const query = useGetCategories();
  const create = useCreateCategory();
  const rename = useRenameCategory();
  const remove = useDeleteCategory();
  const list = query.data ?? [];

  return (
    <div className="space-y-3">
      <CatalogAddRow
        placeholder="اسم قسم جديد، مثال: مشروبات"
        maxLength={CATEGORY_NAME_MAX}
        pending={create.isPending}
        onAdd={(name) => create.mutateAsync(name)}
      />
      {list.length === 0 ? (
        <ListState
          isPending={query.isPending}
          isError={query.isError}
          onRetry={() => query.refetch()}
          empty="لا توجد أقسام بعد. أضف أول قسم بالأعلى."
        />
      ) : (
        <ul className="border px-2">
          {list.map((c) => (
            <CatalogRow
              key={c.id}
              name={c.label}
              meta={itemCount(c.productCount)}
              maxLength={CATEGORY_NAME_MAX}
              pending={
                (rename.isPending && rename.variables?.id === c.id) ||
                (remove.isPending && remove.variables?.id === c.id)
              }
              deleteWarning={
                c.productCount > 0
                  ? `أصنافه (${c.productCount}) لن تُحذف، وستصبح "بدون قسم".`
                  : undefined
              }
              onRename={(name) =>
                rename.mutateAsync({ id: c.id, name, version: c.version })
              }
              onDelete={() =>
                remove.mutateAsync({
                  id: c.id,
                  name: c.label,
                  version: c.version,
                })
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function UnitsPanel() {
  const query = useUnits();
  const create = useCreateUnit();
  const update = useUpdateUnit();
  const remove = useDeleteUnit();
  const [newDecimal, setNewDecimal] = useState(false);
  const list = query.data ?? [];

  return (
    <div className="space-y-3">
      <CatalogAddRow
        placeholder="اسم وحدة جديدة، مثال: شرنك"
        maxLength={UNIT_NAME_MAX}
        pending={create.isPending}
        onAdd={async (name) => {
          await create.mutateAsync({ name, allowDecimal: newDecimal });
          setNewDecimal(false);
        }}
        extra={
          <div className="flex items-center gap-1.5">
            <Switch
              id="new-unit-decimal"
              checked={newDecimal}
              onCheckedChange={setNewDecimal}
            />
            <Label htmlFor="new-unit-decimal" className="text-xs font-normal">
              بالوزن
            </Label>
          </div>
        }
      />
      {list.length === 0 ? (
        <ListState
          isPending={query.isPending}
          isError={query.isError}
          onRetry={() => query.refetch()}
          empty="لا توجد وحدات بعد."
        />
      ) : (
        <ul className="border px-2">
          {list.map((u) => {
            const busy = update.isPending && update.variables?.id === u.id;
            return (
              <CatalogRow
                key={u.id}
                name={u.name}
                meta={itemCount(u.productCount)}
                maxLength={UNIT_NAME_MAX}
                pending={
                  busy || (remove.isPending && remove.variables?.id === u.id)
                }
                extra={
                  <Switch
                    checked={u.allowDecimal}
                    disabled={busy}
                    aria-label={`${u.name} تُباع بالوزن أو بكسور`}
                    title="تُباع بالوزن (تقبل كسوراً)"
                    onCheckedChange={(allowDecimal) =>
                      update.mutate({
                        id: u.id,
                        input: { name: u.name, allowDecimal },
                        version: u.version,
                      })
                    }
                  />
                }
                deleteBlockedReason={
                  u.productCount > 0
                    ? `مستخدمة في ${u.productCount} صنف. غيّر وحدتهم أولاً.`
                    : undefined
                }
                onRename={(name) =>
                  update.mutateAsync({
                    id: u.id,
                    input: { name, allowDecimal: u.allowDecimal },
                    version: u.version,
                  })
                }
                onDelete={() =>
                  remove.mutateAsync({
                    id: u.id,
                    name: u.name,
                    version: u.version,
                  })
                }
              />
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        المفتاح بجانب الوحدة = تُباع بالوزن (مثل 0.5 كجم). اختيارها لصنف يفعّل
        الكسور تلقائياً.
      </p>
    </div>
  );
}
