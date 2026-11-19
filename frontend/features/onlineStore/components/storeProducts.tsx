"use client";

import {
  IconCamera,
  IconEdit,
  IconLoader2,
  IconEye,
  IconEyeOff,
  IconPackage,
  IconSearch,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatWhen } from "@/lib/dates";
import { cn } from "@/lib/utils";

import {
  useBulkPublish,
  useStoreProducts,
  useUpdateStoreProduct,
} from "../hooks/useOnlineStore";
import { useImageUpload } from "../hooks/useImageUpload";
import { formatQtyUnit } from "../lib/storeText";
import type { ProductFilter, StoreProduct } from "../types/store";
import { ProductEditDialog } from "./productEditDialog";
import { StoreImage } from "./storeImage";

const PAGE_SIZE = 50;
const ALL = "__all__";

const FILTERS: { id: ProductFilter; label: string }[] = [
  { id: "all", label: "كل الأصناف" },
  { id: "published", label: "معروضة" },
  { id: "hidden", label: "غير معروضة" },
];

function StockCell({ p }: { p: StoreProduct }) {
  if (!p.isPublished) return <span className="text-muted-foreground">—</span>;
  if (p.availableQty === null)
    return (
      <AppTooltip message="لم يصل مخزون هذا الصنف من فرع التجهيز بعد (يصل مع المزامنة). يظهر متاحاً للعملاء.">
        <span className="text-xs text-muted-foreground">بانتظار المزامنة</span>
      </AppTooltip>
    );
  if (p.availableQty <= 0)
    return (
      <span className="bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">
        نفد
      </span>
    );
  return (
    <AppTooltip
      message={
        p.stockAt
          ? `المخزون ${formatQtyUnit(p.stockQty ?? 0, p.unit)} − المحجوز في الطلبات المفتوحة · آخر تحديث ${formatWhen(p.stockAt)}`
          : "المتاح"
      }
    >
      <span
        className={cn(
          "font-mono text-xs tabular-nums",
          p.availableQty <= 5 && "text-warning",
        )}
      >
        {formatQtyUnit(p.availableQty, p.unit)}
      </span>
    </AppTooltip>
  );
}

/** الصورة المصغّرة: ضغطة واحدة لرفع صورة رئيسية للصنف (أو تغييرها) بدون فتح نافذة التعديل. */
function ThumbUpload({
  p,
  imageBase,
}: {
  p: StoreProduct;
  imageBase: string | null;
}) {
  const update = useUpdateStoreProduct();
  const { pick, busy } = useImageUpload();
  const [preview, setPreview] = useState<string | null>(null);
  const working = busy || update.isPending;

  async function upload() {
    const img = await pick();
    if (!img) return;
    // الصورة القديمة تبقى ضمن الصور الإضافية بدل أن تُحذف.
    const gallery = p.imageId
      ? [p.imageId, ...p.gallery].slice(0, 5)
      : p.gallery;
    update.mutate(
      { gid: p.gid, patch: { imageId: img.id, gallery } },
      {
        onSuccess: () => {
          setPreview(img.previewUrl);
          toast.success(`أُضيفت صورة «${p.name}»`);
        },
      },
    );
  }

  return (
    <AppTooltip message={p.imageId ? "تغيير الصورة الرئيسية" : "إضافة صورة"}>
      <button
        type="button"
        onClick={() => void upload()}
        disabled={working}
        aria-label={p.imageId ? `تغيير صورة ${p.name}` : `إضافة صورة ${p.name}`}
        className="group/thumb relative size-11 shrink-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <StoreImage
          base={imageBase}
          id={p.imageId}
          previewUrl={preview}
          name={p.name}
          className="size-full border"
        />
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-black/50 text-white transition-opacity",
            working
              ? "opacity-100"
              : "opacity-0 group-hover/thumb:opacity-100 group-focus-visible/thumb:opacity-100",
            !p.imageId &&
              !working &&
              "bg-muted text-muted-foreground opacity-100",
          )}
        >
          {working ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconCamera className="size-4" />
          )}
        </span>
      </button>
    </AppTooltip>
  );
}

function ProductRow({
  p,
  imageBase,
  selected,
  onSelect,
  onEdit,
}: {
  p: StoreProduct;
  imageBase: string | null;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onEdit: () => void;
}) {
  const update = useUpdateStoreProduct();
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0",
        selected && "bg-primary/5",
        !p.catalogActive && "opacity-60",
      )}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onSelect(Boolean(v))}
        aria-label={`تحديد ${p.name}`}
      />
      <ThumbUpload p={p} imageBase={imageBase} />
      <div className="min-w-0 flex-1">
        <AppTooltip message={p.name} onlyWhenTruncated>
          <p className="truncate text-sm font-medium">{p.name}</p>
        </AppTooltip>
        <p className="truncate text-xs text-muted-foreground">
          {p.category ?? "بلا تصنيف"}
          {p.barcode && (
            <span dir="ltr" className="ms-2 font-mono">
              {p.barcode}
            </span>
          )}
          {!p.catalogActive && " · موقوف في البرنامج"}
          {p.isPublished && !p.imageId && " · بلا صورة"}
        </p>
      </div>
      <Money
        amount={p.price}
        className="hidden w-28 justify-end sm:inline-flex"
      />
      <div className="hidden w-28 text-center md:block">
        <StockCell p={p} />
      </div>
      <AppTooltip
        message={p.featured ? "إلغاء التمييز" : "تمييز في الصفحة الرئيسية"}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={p.featured ? "إلغاء التمييز" : "صنف مميز"}
          aria-pressed={p.featured}
          disabled={update.isPending || (!p.isPublished && !p.featured)}
          onClick={() =>
            update.mutate({ gid: p.gid, patch: { featured: !p.featured } })
          }
        >
          {p.featured ? (
            <IconStarFilled className="size-4 text-warning" />
          ) : (
            <IconStar className="size-4" />
          )}
        </Button>
      </AppTooltip>
      <AppTooltip message="الصورة والوصف وحد الكمية">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="تعديل العرض"
          onClick={onEdit}
        >
          <IconEdit className="size-4" />
        </Button>
      </AppTooltip>
      <Switch
        checked={p.isPublished}
        disabled={update.isPending}
        onCheckedChange={(v) =>
          update.mutate({ gid: p.gid, patch: { isPublished: v } })
        }
        aria-label={p.isPublished ? `إخفاء ${p.name}` : `عرض ${p.name}`}
      />
    </li>
  );
}

/** اختيار ما يُعرض في المتجر من أصناف المحل (الكتالوج المشترك بين الفروع). */
export function StoreProducts({ imageBase }: { imageBase: string | null }) {
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [category, setCategory] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const q = useDebouncedValue(search.trim(), 300);
  const query = useStoreProducts({
    q: q || undefined,
    status: filter,
    category: category === ALL ? undefined : category,
    page,
    pageSize: PAGE_SIZE,
  });
  const bulk = useBulkPublish();
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const items = useMemo(() => data?.items ?? [], [data]);
  const allSelected =
    items.length > 0 && items.every((p) => selected.has(p.gid));

  const toggle = (gid: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(gid);
      else next.delete(gid);
      return next;
    });
  const reset = () => {
    setPage(1);
    setSelected(new Set());
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border bg-card p-3 text-sm">
        <span className="flex items-center gap-1.5">
          <IconEye className="size-4 text-success" />
          <b className="font-mono">{data?.publishedCount ?? "—"}</b> صنف معروض
          في المتجر
        </span>
        <span className="text-xs text-muted-foreground">
          الاسم والسعر والتصنيف من أصنافك مباشرة، وأي تعديل يظهر في المتجر مع
          المزامنة.
          {data?.stockBranch && ` المخزون المتاح من فرع «${data.stockBranch}».`}
        </span>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SegmentedTabs
          label="عرض الأصناف"
          items={FILTERS}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            reset();
          }}
          className="min-w-0 flex-1"
        />
        <div className="flex gap-2">
          {data && data.categories.length > 0 && (
            <OptionSelect
              label="التصنيف"
              value={category}
              items={[
                { value: ALL, label: "كل التصنيفات" },
                ...data.categories.map((c) => ({ value: c, label: c })),
              ]}
              onChange={(v) => {
                setCategory(v);
                reset();
              }}
              className="w-44"
            />
          )}
          <div className="relative w-full lg:w-64">
            <IconSearch className="pointer-events-none absolute inset-s-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                reset();
              }}
              placeholder="ابحث بالاسم أو الباركود"
              aria-label="بحث في الأصناف"
              className="h-10 ps-8"
            />
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border border-primary bg-primary/5 p-2 ps-3 text-sm backdrop-blur">
          <span className="me-auto">
            تم تحديد <b className="font-mono">{selected.size}</b> صنف
          </span>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={bulk.isPending}
            onClick={() =>
              bulk.mutate(
                { gids: [...selected], isPublished: true },
                { onSuccess: () => setSelected(new Set()) },
              )
            }
          >
            <IconEye className="size-4" />
            عرض في المتجر
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={bulk.isPending}
            onClick={() =>
              bulk.mutate(
                { gids: [...selected], isPublished: false },
                { onSuccess: () => setSelected(new Set()) },
              )
            }
          >
            <IconEyeOff className="size-4" />
            إخفاء
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            إلغاء التحديد
          </Button>
        </div>
      )}

      {query.isPending ? (
        <div className="space-y-1 border bg-card p-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border bg-card p-10 text-center">
          <IconPackage className="size-10 text-muted-foreground" />
          <p className="font-medium">
            {q || category !== ALL || filter !== "all"
              ? "لا أصناف مطابقة"
              : "لا توجد أصناف في كتالوج المحل بعد"}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            الأصناف تأتي من كتالوج الفروع المشترك. لو أضفت أصنافاً للتو انتظر
            دقيقة حتى تتم المزامنة.
          </p>
        </div>
      ) : (
        <div className={cn("border bg-card", query.isFetching && "opacity-80")}>
          <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) =>
                setSelected((s) => {
                  const next = new Set(s);
                  for (const p of items) {
                    if (v) next.add(p.gid);
                    else next.delete(p.gid);
                  }
                  return next;
                })
              }
              aria-label="تحديد كل الصفحة"
            />
            <span className="flex-1 ps-14">الصنف</span>
            <span className="hidden w-28 text-end sm:block">السعر</span>
            <span className="hidden w-28 text-center md:block">المتاح</span>
            <span className="w-[7.5rem] text-end">معروض</span>
          </div>
          <ul>
            {items.map((p) => (
              <ProductRow
                key={p.gid}
                p={p}
                imageBase={imageBase}
                selected={selected.has(p.gid)}
                onSelect={(v) => toggle(p.gid, v)}
                onEdit={() => setEditing(p)}
              />
            ))}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            السابق
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {page} / {pages} · {data?.total} صنف
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            التالي
          </Button>
        </div>
      )}

      <ProductEditDialog
        product={editing}
        imageBase={imageBase}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
