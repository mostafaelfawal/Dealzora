"use client";

import {
  IconBuildingStore,
  IconCheck,
  IconDeviceFloppy,
  IconLink,
  IconLoader2,
  IconPhone,
  IconPhotoPlus,
  IconRocket,
  IconTrash,
  IconTruckDelivery,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { CurrencyLabel } from "@/components/shared/CurrencyLabel";
import {
  FormField,
  FormSection,
  SavingLabel,
  SwitchField,
} from "@/components/shared/form";
import { OptionSelect } from "@/components/shared/OptionSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  moneyInputOrZero,
  normalizeDigits,
  parseNumberInput,
} from "@/lib/format";
import { cn } from "@/lib/utils";

import { checkSlug } from "../api/store.api";
import { useSaveStore, useUploadStoreImage } from "../hooks/useOnlineStore";
import { compressImage } from "../lib/imageResize";
import { slugError, toSlug } from "../lib/storeText";
import type { StoreSettingsInput, StoreState } from "../types/store";
import { StoreImage } from "./storeImage";

const PHONE_RE = /^\+?[\d\s\-()]{8,20}$/;

type Draft = Omit<
  StoreSettingsInput,
  "deliveryFee" | "freeDeliveryOver" | "minOrder"
> & { deliveryFee: string; freeDeliveryOver: string; minOrder: string };

function initialDraft(state: StoreState): Draft {
  const s = state.store;
  const money = (v: number | null | undefined) =>
    v === null || v === undefined || v === 0 ? "" : String(v);
  return {
    slug: s?.slug ?? state.suggestedSlug,
    name: s?.name ?? state.suggestedName,
    tagline: s?.tagline ?? "",
    about: s?.about ?? "",
    phone: s?.phone ?? "",
    whatsapp: s?.whatsapp ?? "",
    city: s?.city ?? "",
    address: s?.address ?? "",
    hours: s?.hours ?? "",
    logoImageId: s?.logoImageId ?? null,
    isPublished: s?.isPublished ?? false,
    acceptingOrders: s?.acceptingOrders ?? true,
    deliveryFee: money(s?.deliveryFee),
    freeDeliveryOver: money(s?.freeDeliveryOver),
    minOrder: money(s?.minOrder),
    deliveryNote: s?.deliveryNote ?? "",
    fulfillmentBranchId: s?.fulfillmentBranchId ?? null,
  };
}

function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {};
  const slug = slugError(d.slug);
  if (slug) e.slug = slug;
  if (d.name.trim().length < 2) e.name = "اكتب اسم المتجر كما يراه العملاء";
  if (!PHONE_RE.test(normalizeDigits(d.phone).trim()))
    e.phone = "رقم هاتف صحيح يتصل عليه العملاء";
  if (d.whatsapp && !PHONE_RE.test(normalizeDigits(d.whatsapp).trim()))
    e.whatsapp = "رقم واتساب غير صحيح";
  const free = d.freeDeliveryOver ? parseNumberInput(d.freeDeliveryOver) : 0;
  const fee = d.deliveryFee ? parseNumberInput(d.deliveryFee) : 0;
  if (Number.isNaN(fee) || fee < 0) e.deliveryFee = "مبلغ غير صحيح";
  if (Number.isNaN(free) || free < 0) e.freeDeliveryOver = "مبلغ غير صحيح";
  const min = d.minOrder ? parseNumberInput(d.minOrder) : 0;
  if (Number.isNaN(min) || min < 0) e.minOrder = "مبلغ غير صحيح";
  return e;
}

function SlugStatus({ slug, current }: { slug: string; current?: string }) {
  const debounced = useDebouncedValue(slug, 450);
  const [state, setState] = useState<{
    slug: string;
    ok: boolean;
    message: string | null;
  } | null>(null);
  useEffect(() => {
    if (!debounced || slugError(debounced) || debounced === current) return;
    let alive = true;
    checkSlug(debounced)
      .then((r) => {
        if (alive)
          setState({ slug: debounced, ok: r.available, message: r.message });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [debounced, current]);

  if (!slug || slugError(slug) || slug === current) return null;
  if (state?.slug !== slug)
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <IconLoader2 className="size-3.5 animate-spin" />
        جارٍ التحقق…
      </span>
    );
  return state.ok ? (
    <span className="flex items-center gap-1 text-xs text-success">
      <IconCheck className="size-3.5" />
      الرابط متاح
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <IconX className="size-3.5" />
      {state.message ?? "الرابط غير متاح"}
    </span>
  );
}

function LogoPicker({
  imageBase,
  imageId,
  name,
  onChange,
}: {
  imageBase: string | null;
  imageId: string | null;
  name: string;
  onChange: (id: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadStoreImage();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const img = await compressImage(file, { square: true });
      const out = await upload.mutateAsync({
        contentType: img.contentType,
        base64: img.base64,
      });
      setPreview(img.previewUrl);
      onChange(out.id);
    } catch (e) {
      if (e instanceof Error && !("isAxiosError" in e)) toast.error(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <StoreImage
        base={imageBase}
        id={imageId}
        previewUrl={imageId ? preview : null}
        name={name}
        className="size-16 shrink-0 border"
      />
      <div className="space-y-1">
        <div className="flex gap-1.5">
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
            {imageId ? "تغيير الشعار" : "رفع شعار"}
          </Button>
          {imageId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive"
              onClick={() => {
                setPreview(null);
                onChange(null);
              }}
            >
              <IconTrash className="size-4" />
              إزالة
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          صورة مربعة، تُضغط تلقائياً قبل الرفع.
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
  );
}

/** إعدادات المتجر: الإنشاء أول مرة (mode=create) والتعديل لاحقاً بنفس النموذج. */
export function StoreSettingsForm({
  state,
  mode,
  onSaved,
}: {
  state: StoreState;
  mode: "create" | "edit";
  onSaved?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(state));
  const [touched, setTouched] = useState(false);
  const save = useSaveStore();
  const errors = validate(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const show = (k: keyof Draft) => (touched ? errors[k] : undefined);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const base = state.publicBaseUrl ?? "رابط-المتجر";
  const branches = state.branches.filter((b) => b.isActive);
  const mainBranch = branches.find((b) => b.isAdmin);

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (hasErrors) {
      toast.error("راجع الحقول المظللة بالأحمر");
      return;
    }
    const money = (v: string) => moneyInputOrZero(v);
    save.mutate(
      {
        ...draft,
        phone: normalizeDigits(draft.phone),
        whatsapp: draft.whatsapp ? normalizeDigits(draft.whatsapp) : null,
        deliveryFee: money(draft.deliveryFee),
        freeDeliveryOver: draft.freeDeliveryOver.trim()
          ? money(draft.freeDeliveryOver)
          : null,
        minOrder: money(draft.minOrder),
      },
      { onSuccess: () => onSaved?.() },
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex max-w-3xl flex-col gap-4"
      noValidate
    >
      <FormSection
        title={
          <span className="flex items-center gap-2">
            <IconBuildingStore className="size-4" />
            هوية المتجر
          </span>
        }
        description="ما يراه العميل أول ما يفتح متجرك."
      >
        <LogoPicker
          imageBase={state.imageBase}
          imageId={draft.logoImageId}
          name={draft.name}
          onChange={(id) => set("logoImageId", id)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="st-name" label="اسم المتجر" error={show("name")}>
            <Input
              id="st-name"
              value={draft.name}
              maxLength={80}
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={Boolean(show("name"))}
            />
          </FormField>
          <FormField
            id="st-tagline"
            label="جملة تعريفية"
            hint="مثال: كل احتياجات البيت لحد بابك"
          >
            <Input
              id="st-tagline"
              value={draft.tagline ?? ""}
              maxLength={160}
              onChange={(e) => set("tagline", e.target.value)}
            />
          </FormField>
        </div>
        <FormField id="st-about" label="عن المتجر (اختياري)">
          <Textarea
            id="st-about"
            value={draft.about ?? ""}
            maxLength={600}
            rows={3}
            onChange={(e) => set("about", e.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection
        title={
          <span className="flex items-center gap-2">
            <IconLink className="size-4" />
            رابط المتجر
          </span>
        }
        description="الرابط الذي تشاركه مع عملائك على واتساب وفيسبوك. اختره قصيراً وسهل التذكر."
      >
        <FormField id="st-slug" label="الرابط" error={show("slug")}>
          <div
            dir="ltr"
            className={cn(
              "flex h-10 items-stretch border bg-background focus-within:ring-2 focus-within:ring-ring/50",
              show("slug") && "border-destructive",
            )}
          >
            <span className="flex max-w-[55%] items-center truncate border-e bg-muted px-2.5 font-mono text-xs text-muted-foreground">
              {base}/
            </span>
            <input
              id="st-slug"
              value={draft.slug}
              onChange={(e) => set("slug", toSlug(e.target.value))}
              className="min-w-0 flex-1 bg-transparent px-2.5 font-mono text-sm outline-none"
              placeholder="super-market"
              aria-invalid={Boolean(show("slug"))}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </FormField>
        <SlugStatus slug={draft.slug} current={state.store?.slug} />
        {mode === "edit" && state.store && draft.slug !== state.store.slug && (
          <p className="border border-warning/40 bg-warning/5 p-2 text-xs text-warning">
            تغيير الرابط يوقف الرابط القديم فوراً، وأي رابط شاركته سابقاً لن يعمل.
          </p>
        )}
      </FormSection>

      <FormSection
        title={
          <span className="flex items-center gap-2">
            <IconPhone className="size-4" />
            التواصل والعنوان
          </span>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="st-phone" label="هاتف المتجر" error={show("phone")}>
            <Input
              id="st-phone"
              dir="ltr"
              inputMode="tel"
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="01xxxxxxxxx"
              aria-invalid={Boolean(show("phone"))}
              className="text-start"
            />
          </FormField>
          <FormField
            id="st-wa"
            label="واتساب (اختياري)"
            error={show("whatsapp")}
            hint="يظهر للعميل زر تواصل مباشر"
          >
            <Input
              id="st-wa"
              dir="ltr"
              inputMode="tel"
              value={draft.whatsapp ?? ""}
              onChange={(e) => set("whatsapp", e.target.value)}
              aria-invalid={Boolean(show("whatsapp"))}
              className="text-start"
            />
          </FormField>
          <FormField id="st-city" label="المدينة / المنطقة">
            <Input
              id="st-city"
              value={draft.city ?? ""}
              maxLength={60}
              onChange={(e) => set("city", e.target.value)}
              placeholder="مثال: المعادي، القاهرة"
            />
          </FormField>
          <FormField id="st-hours" label="مواعيد العمل">
            <Input
              id="st-hours"
              value={draft.hours ?? ""}
              maxLength={120}
              onChange={(e) => set("hours", e.target.value)}
              placeholder="يومياً من 9 صباحاً حتى 12 منتصف الليل"
            />
          </FormField>
        </div>
        <FormField id="st-address" label="عنوان المحل">
          <Input
            id="st-address"
            value={draft.address ?? ""}
            maxLength={200}
            onChange={(e) => set("address", e.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection
        title={
          <span className="flex items-center gap-2">
            <IconTruckDelivery className="size-4" />
            التوصيل والطلبات
          </span>
        }
        description="الدفع عند الاستلام فقط. العميل يرى رسوم التوصيل والإجمالي قبل تأكيد الطلب."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            id="st-fee"
            label={
              <>
                رسوم التوصيل <CurrencyLabel />
              </>
            }
            error={show("deliveryFee")}
            hint="اتركه فارغاً للتوصيل المجاني"
          >
            <Input
              id="st-fee"
              dir="ltr"
              inputMode="decimal"
              value={draft.deliveryFee}
              onChange={(e) => set("deliveryFee", e.target.value)}
              placeholder="0"
              className="text-start font-mono"
            />
          </FormField>
          <FormField
            id="st-free"
            label={
              <>
                توصيل مجاني من <CurrencyLabel />
              </>
            }
            error={show("freeDeliveryOver")}
            hint="اختياري"
          >
            <Input
              id="st-free"
              dir="ltr"
              inputMode="decimal"
              value={draft.freeDeliveryOver}
              onChange={(e) => set("freeDeliveryOver", e.target.value)}
              placeholder="—"
              className="text-start font-mono"
            />
          </FormField>
          <FormField
            id="st-min"
            label={
              <>
                أقل قيمة للطلب <CurrencyLabel />
              </>
            }
            error={show("minOrder")}
            hint="اختياري"
          >
            <Input
              id="st-min"
              dir="ltr"
              inputMode="decimal"
              value={draft.minOrder}
              onChange={(e) => set("minOrder", e.target.value)}
              placeholder="0"
              className="text-start font-mono"
            />
          </FormField>
        </div>
        <FormField
          id="st-dnote"
          label="ملاحظة التوصيل"
          hint="مثال: التوصيل خلال ساعتين داخل المعادي"
        >
          <Input
            id="st-dnote"
            value={draft.deliveryNote ?? ""}
            maxLength={200}
            onChange={(e) => set("deliveryNote", e.target.value)}
          />
        </FormField>
        {branches.length > 1 && (
          <FormField
            id="st-branch"
            label="فرع تجهيز الطلبات"
            hint="مخزون هذا الفرع هو ما يظهر متاحاً في المتجر."
          >
            <OptionSelect
              label="فرع تجهيز الطلبات"
              value={draft.fulfillmentBranchId ?? mainBranch?.id ?? ""}
              items={branches.map((b) => ({
                value: b.id,
                label: b.isAdmin ? `${b.name} (الرئيسي)` : b.name,
              }))}
              onChange={(v) =>
                set(
                  "fulfillmentBranchId",
                  v === mainBranch?.id ? null : (v as string),
                )
              }
            />
          </FormField>
        )}
        <SwitchField
          id="st-accepting"
          label="استقبال الطلبات"
          description="أوقفه مؤقتاً (زحام، إجازة) والمتجر يبقى ظاهراً للتصفح."
          checked={draft.acceptingOrders}
          onCheckedChange={(v) => set("acceptingOrders", v)}
        />
      </FormSection>

      {mode === "edit" && (
        <FormSection>
          <SwitchField
            id="st-published"
            label="المتجر منشور"
            description="عند الإيقاف يختفي المتجر عن الزوار تماماً، وتبقى طلباته وإعداداته محفوظة."
            checked={draft.isPublished}
            onCheckedChange={(v) => set("isPublished", v)}
          />
        </FormSection>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
        {mode === "create" ? (
          <>
            <p className="me-auto text-xs text-muted-foreground">
              بعد الإنشاء اختر الأصناف المعروضة ثم انشر المتجر.
            </p>
            <Button
              type="submit"
              size="lg"
              className="h-10 gap-2"
              disabled={save.isPending}
            >
              {save.isPending ? (
                <SavingLabel text="جارٍ الإنشاء…" />
              ) : (
                <>
                  <IconRocket className="size-4" />
                  إنشاء المتجر
                </>
              )}
            </Button>
          </>
        ) : (
          <Button
            type="submit"
            size="lg"
            className="h-10 gap-2"
            disabled={save.isPending}
          >
            {save.isPending ? (
              <SavingLabel />
            ) : (
              <>
                <IconDeviceFloppy className="size-4" />
                حفظ الإعدادات
              </>
            )}
          </Button>
        )}
      </div>
    </form>
  );
}
