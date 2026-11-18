"use client";

import {
  IconLoader2,
  IconPhotoPlus,
  IconStar,
  IconTrash,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

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

import {
  useUpdateStoreProduct,
  useUploadStoreImage,
} from "../hooks/useOnlineStore";
import { compressImage } from "../lib/imageResize";
import type { StoreProduct } from "../types/store";
import { StoreImage } from "./storeImage";

/** عرض الصنف في المتجر: صورة ووصف ومميز وحد للكمية. الاسم والسعر من الأصناف نفسها. */
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
  const upload = useUploadStoreImage();
  const input = useRef<HTMLInputElement>(null);
  const [imageId, setImageId] = useState<string | null>(product.imageId);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState(product.description ?? "");
  const [featured, setFeatured] = useState(product.featured);
  const [published, setPublished] = useState(product.isPublished);
  const [maxQty, setMaxQty] = useState(
    product.maxQty === null ? "" : String(product.maxQty),
  );
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const img = await compressImage(file);
      const out = await upload.mutateAsync({
        contentType: img.contentType,
        base64: img.base64,
      });
      setImageId(out.id);
      setPreview(img.previewUrl);
    } catch (e) {
      if (e instanceof Error && !("isAxiosError" in e)) toast.error(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
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
          imageId,
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

      {
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <StoreImage
              base={imageBase}
              id={imageId}
              previewUrl={preview}
              name={product.name}
              className="aspect-square w-24 shrink-0 border"
            />
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  {busy ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconPhotoPlus className="size-4" />
                  )}
                  {imageId ? "تغيير الصورة" : "إضافة صورة"}
                </Button>
                {imageId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive"
                    onClick={() => {
                      setImageId(null);
                      setPreview(null);
                    }}
                  >
                    <IconTrash className="size-4" />
                    إزالة
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                صورة واضحة بخلفية فاتحة تزيد المبيعات. تُضغط تلقائياً.
              </p>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </div>

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
                <IconStar className="size-4 text-warning" />
                صنف مميز
              </span>
            }
            description="يظهر في أعلى الصفحة الرئيسية للمتجر."
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
      }

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
