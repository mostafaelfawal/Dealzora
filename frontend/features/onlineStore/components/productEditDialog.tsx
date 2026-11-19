"use client";

import {
  IconLoader2,
  IconPhotoPlus,
  IconStar,
  IconStarFilled,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Money } from "@/components/shared/Money";
import { FormField, SavingLabel, SwitchField } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseNumberInput } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useImageUpload } from "../hooks/useImageUpload";
import { useUpdateStoreProduct } from "../hooks/useOnlineStore";
import type { StoreProduct } from "../types/store";
import { StoreImage } from "./storeImage";

/** الرئيسية + حتى 5 إضافية (نفس حد السيرفر). */
const MAX_IMAGES = 6;

/** عرض الصنف في المتجر: الصور والوصف والتمييز وحد الكمية. الاسم والسعر من الأصناف نفسها. */
export function ProductEditDialog({
  product,
  imageBase,
  onClose,
}: {
  product: StoreProduct | null;
  imageBase: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={product !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {product && (
          <ProductForm
            key={product.gid}
            product={product}
            imageBase={imageBase}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** صور الصنف: الأولى هي الرئيسية (في البطاقة)، والباقي يظهر في صفحة الصنف. */
function ImagesEditor({
  images,
  previews,
  imageBase,
  name,
  busy,
  onAdd,
  onChange,
}: {
  images: string[];
  previews: Record<string, string>;
  imageBase: string | null;
  name: string;
  busy: boolean;
  onAdd: () => void;
  onChange: (images: string[]) => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">صور الصنف</h3>
        <span className="text-xs text-muted-foreground">
          {images.length} / {MAX_IMAGES}
        </span>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((id, i) => (
          <li key={id} className="group relative">
            <StoreImage
              base={imageBase}
              id={id}
              previewUrl={previews[id]}
              name={name}
              className={cn(
                "aspect-square w-full border",
                i === 0 && "border-primary ring-1 ring-primary",
              )}
            />
            {i === 0 ? (
              <span className="absolute inset-x-0 bottom-0 bg-primary py-0.5 text-center text-[10px] text-primary-foreground">
                الرئيسية
              </span>
            ) : (
              <AppTooltip message="اجعلها الصورة الرئيسية">
                <button
                  type="button"
                  aria-label="اجعلها الصورة الرئيسية"
                  onClick={() =>
                    onChange([id, ...images.filter((x) => x !== id)])
                  }
                  className="absolute bottom-1 inset-s-1 flex size-6 items-center justify-center bg-background/90 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <IconStar className="size-3.5" />
                </button>
              </AppTooltip>
            )}
            <button
              type="button"
              aria-label="حذف الصورة"
              onClick={() => onChange(images.filter((x) => x !== id))}
              className="absolute top-1 inset-e-1 flex size-6 items-center justify-center bg-background/90 text-destructive opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <IconX className="size-3.5" />
            </button>
          </li>
        ))}
        {images.length < MAX_IMAGES && (
          <li>
            <button
              type="button"
              onClick={onAdd}
              disabled={busy}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-60"
            >
              {busy ? (
                <IconLoader2 className="size-5 animate-spin" />
              ) : (
                <IconPhotoPlus className="size-5" />
              )}
              {images.length ? "صورة أخرى" : "إضافة صورة"}
            </button>
          </li>
        )}
      </ul>
      <p className="text-xs text-muted-foreground">
        الأولى تظهر في بطاقة الصنف، والباقي في صفحته. صور واضحة بخلفية فاتحة
        تزيد المبيعات، وتُضغط تلقائياً قبل الرفع.
      </p>
    </section>
  );
}

function ProductForm({
  product,
  imageBase,
  onClose,
}: {
  product: StoreProduct;
  imageBase: string | null;
  onClose: () => void;
}) {
  const update = useUpdateStoreProduct();
  const { pick, busy } = useImageUpload();
  const [images, setImages] = useState<string[]>(
    [product.imageId, ...product.gallery].filter((x): x is string => !!x),
  );
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [description, setDescription] = useState(product.description ?? "");
  const [featured, setFeatured] = useState(product.featured);
  const [published, setPublished] = useState(product.isPublished);
  const [maxQty, setMaxQty] = useState(
    product.maxQty === null ? "" : String(product.maxQty),
  );

  async function addImage() {
    const img = await pick();
    if (!img) return;
    setPreviews((p) => ({ ...p, [img.id]: img.previewUrl }));
    setImages((cur) => [...cur, img.id].slice(0, MAX_IMAGES));
  }

  const max = maxQty.trim() ? parseNumberInput(maxQty) : null;
  const maxInvalid = max !== null && (!Number.isFinite(max) || max <= 0);

  function save() {
    if (maxInvalid) return;
    update.mutate(
      {
        gid: product.gid,
        patch: {
          isPublished: published,
          featured,
          description: description.trim() || null,
          imageId: images[0] ?? null,
          gallery: images.slice(1),
          maxQty: max,
        },
      },
      {
        onSuccess: () => {
          toast.success(`حُفظ «${product.name}» في المتجر`);
          onClose();
        },
      },
    );
  }

  return (
    <>
      <DialogHeader className="text-start">
        <DialogTitle>{product.name}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-2">
          <span>
            السعر في المتجر <Money amount={product.price} className="text-xs" />
          </span>
          <span>· يتغيّر تلقائياً مع سعر الصنف في البرنامج</span>
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto pe-1">
        <ImagesEditor
          images={images}
          previews={previews}
          imageBase={imageBase}
          name={product.name}
          busy={busy}
          onAdd={() => void addImage()}
          onChange={setImages}
        />

        <FormField id="sp-desc" label="الوصف (اختياري)">
          <Textarea
            id="sp-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="الحجم، المكونات، بلد المنشأ…"
          />
        </FormField>

        <FormField
          id="sp-max"
          label={`أقصى كمية في الطلب الواحد (${product.unit})`}
          hint="اختياري. فارغ = حسب المخزون المتاح فقط."
          error={maxInvalid ? "كمية غير صحيحة" : undefined}
        >
          <Input
            id="sp-max"
            dir="ltr"
            inputMode="decimal"
            value={maxQty}
            onChange={(e) => setMaxQty(e.target.value)}
            placeholder="—"
            className="text-start font-mono"
          />
        </FormField>

        <SwitchField
          id="sp-featured"
          label={
            <span className="flex items-center gap-1.5">
              <IconStarFilled className="size-4 text-warning" />
              صنف مميز
            </span>
          }
          description="يظهر في «مختارات المتجر» أعلى الصفحة الرئيسية."
          checked={featured}
          onCheckedChange={setFeatured}
        />
        <SwitchField
          id="sp-published"
          label="معروض في المتجر"
          checked={published}
          onCheckedChange={setPublished}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          إلغاء
        </Button>
        <Button
          onClick={save}
          disabled={update.isPending || busy || maxInvalid}
        >
          {update.isPending ? <SavingLabel /> : "حفظ"}
        </Button>
      </div>
    </>
  );
}
