"use client";

import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTiktok,
  IconCheck,
  IconDeviceDesktop,
  IconDeviceFloppy,
  IconLoader2,
  IconMoon,
  IconPalette,
  IconPhotoPlus,
  IconShoppingBag,
  IconSpeakerphone,
  IconSun,
  IconTrash,
} from "@tabler/icons-react";
import { useState, type CSSProperties, type ReactNode } from "react";

import {
  FormField,
  FormSection,
  SavingLabel,
  SwitchField,
} from "@/components/shared/form";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useImageUpload } from "../hooks/useImageUpload";
import { useSaveTheme } from "../hooks/useOnlineStore";
import { THEME_COLORS, THEME_PALETTE } from "../lib/themePalette";
import type { StoreSettings, StoreTheme } from "../types/store";
import { StoreImage } from "./storeImage";

const MODES = [
  { id: "system", label: "حسب جهاز العميل" },
  { id: "light", label: "فاتح دائماً" },
  { id: "dark", label: "داكن دائماً" },
] as const;

/** نفس قاعدة السيرفر تقريباً: النطاق الصحيح لكل منصة (السيرفر يتحقق بدقة ويرفض غيرها). */
const SOCIAL: {
  key: "facebook" | "instagram" | "tiktok";
  label: string;
  icon: ReactNode;
  host: RegExp;
  placeholder: string;
}[] = [
  {
    key: "facebook",
    label: "فيسبوك",
    icon: <IconBrandFacebook className="size-4" />,
    host: /(^|\.)(facebook\.com|fb\.com|fb\.me)(\/|$)/i,
    placeholder: "facebook.com/elbaraka",
  },
  {
    key: "instagram",
    label: "إنستجرام",
    icon: <IconBrandInstagram className="size-4" />,
    host: /(^|\.)instagram\.com(\/|$)/i,
    placeholder: "instagram.com/elbaraka",
  },
  {
    key: "tiktok",
    label: "تيك توك",
    icon: <IconBrandTiktok className="size-4" />,
    host: /(^|\.)tiktok\.com(\/|$)/i,
    placeholder: "tiktok.com/@elbaraka",
  },
];

function socialError(value: string | null, host: RegExp): string | undefined {
  const v = (value ?? "").trim();
  if (!v) return undefined;
  const bare = v.replace(/^https?:\/\//i, "");
  return host.test(bare) ? undefined : "رابط صفحة من نفس المنصة فقط";
}

/** معاينة مصغّرة لواجهة المتجر بنفس اللون والوضع والغلاف (تتحدّث مع كل تغيير). */
function Preview({
  store,
  theme,
  imageBase,
  coverPreview,
}: {
  store: StoreSettings;
  theme: StoreTheme;
  imageBase: string | null;
  coverPreview: string | null;
}) {
  const [previewDark, setPreviewDark] = useState(false);
  const dark =
    theme.mode === "dark" || (theme.mode === "system" && previewDark);
  const colors = THEME_PALETTE[theme.color][dark ? "dark" : "light"];
  const surface = dark
    ? {
        bg: "oklch(0.145 0 0)",
        card: "oklch(0.205 0 0)",
        fg: "oklch(0.985 0 0)",
        muted: "oklch(0.708 0 0)",
        border: "oklch(1 0 0 / 10%)",
      }
    : {
        bg: "oklch(1 0 0)",
        card: "oklch(0.985 0 0)",
        fg: "oklch(0.145 0 0)",
        muted: "oklch(0.556 0 0)",
        border: "oklch(0.922 0 0)",
      };
  const btn: CSSProperties = { background: colors.primary, color: colors.fg };
  const coverSrc =
    coverPreview ??
    (imageBase && theme.coverImageId
      ? `${imageBase}${theme.coverImageId}`
      : null);

  return (
    <div className="space-y-2 lg:sticky lg:top-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">معاينة</h3>
        {theme.mode === "system" && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="gap-1"
            onClick={() => setPreviewDark((v) => !v)}
          >
            {previewDark ? (
              <IconSun className="size-3.5" />
            ) : (
              <IconMoon className="size-3.5" />
            )}
            {previewDark ? "فاتح" : "داكن"}
          </Button>
        )}
      </div>
      <div
        dir="rtl"
        aria-hidden
        className="overflow-hidden border text-[11px] shadow-sm"
        style={{
          background: surface.bg,
          color: surface.fg,
          borderColor: surface.border,
        }}
      >
        {theme.announcement && (
          <div
            className="truncate px-3 py-1.5 text-center font-medium"
            style={btn}
          >
            {theme.announcement}
          </div>
        )}
        <div
          className="flex items-center gap-2 border-b px-3 py-2"
          style={{ borderColor: surface.border }}
        >
          <StoreImage
            base={imageBase}
            id={store.logoImageId}
            name={store.name}
            className="size-6 shrink-0"
          />
          <span className="flex-1 truncate font-bold">{store.name}</span>
          <span className="flex items-center gap-1 px-2 py-1" style={btn}>
            <IconShoppingBag className="size-3" />
            السلة
          </span>
        </div>
        <div
          className="relative m-3 overflow-hidden border p-3"
          style={{ borderColor: surface.border, background: surface.card }}
        >
          {coverSrc && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- معاينة محلية */}
              <img
                src={coverSrc}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
              <span className="absolute inset-0 bg-linear-to-l from-black/75 via-black/45 to-black/10" />
            </>
          )}
          <div
            className="relative space-y-1"
            style={coverSrc ? { color: "white" } : undefined}
          >
            <p className="text-sm font-bold">{store.name}</p>
            {store.tagline && (
              <p className="truncate opacity-80">{store.tagline}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 px-3 pb-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="border"
              style={{ borderColor: surface.border, background: surface.card }}
            >
              <div
                className="aspect-square"
                style={{
                  background: dark ? "oklch(0.269 0 0)" : "oklch(0.97 0 0)",
                }}
              />
              <div className="space-y-1 p-1.5">
                <div
                  className="h-1.5 w-3/4"
                  style={{ background: surface.muted, opacity: 0.4 }}
                />
                <div
                  className="py-1 text-center text-[9px] font-medium"
                  style={btn}
                >
                  أضف للسلة
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        معاينة تقريبية. افتح المتجر بعد الحفظ لترى الشكل الكامل.
      </p>
    </div>
  );
}

/** مظهر المتجر: اللون، الوضع الفاتح/الداكن، صورة الغلاف، شريط الإعلان، وروابط التواصل. */
export function StoreAppearance({
  store,
  imageBase,
}: {
  store: StoreSettings;
  imageBase: string | null;
}) {
  const [theme, setTheme] = useState<StoreTheme>(store.theme);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const { pick, busy } = useImageUpload();
  const save = useSaveTheme();
  const set = <K extends keyof StoreTheme>(k: K, v: StoreTheme[K]) =>
    setTheme((t) => ({ ...t, [k]: v }));
  const errors = Object.fromEntries(
    SOCIAL.map((s) => [s.key, socialError(theme[s.key], s.host)]),
  ) as Record<(typeof SOCIAL)[number]["key"], string | undefined>;
  const invalid = Object.values(errors).some(Boolean);
  const dirty = JSON.stringify(theme) !== JSON.stringify(store.theme);

  async function uploadCover() {
    const img = await pick();
    if (!img) return;
    setCoverPreview(img.previewUrl);
    set("coverImageId", img.id);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <FormSection
          title={
            <span className="flex items-center gap-2">
              <IconPalette className="size-4" />
              اللون والوضع
            </span>
          }
          description="لون الأزرار والعناصر البارزة في متجرك. كل الألوان مختارة لتبقى واضحة في الوضعين الفاتح والداكن."
        >
          <div
            role="radiogroup"
            aria-label="لون المتجر"
            className="grid grid-cols-4 gap-2 sm:grid-cols-8"
          >
            {THEME_COLORS.map((c) => {
              const active = theme.color === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={THEME_PALETTE[c].label}
                  title={THEME_PALETTE[c].label}
                  onClick={() => set("color", c)}
                  className={cn(
                    "flex flex-col items-center gap-1 border p-2 text-[10px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active ? "border-foreground" : "hover:border-foreground/40",
                  )}
                >
                  <span
                    className="flex size-7 items-center justify-center rounded-full"
                    style={{
                      background: THEME_PALETTE[c].light.primary,
                      color: THEME_PALETTE[c].light.fg,
                    }}
                  >
                    {active && <IconCheck className="size-4" />}
                  </span>
                  <span className="truncate">
                    {THEME_PALETTE[c].label.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <IconDeviceDesktop className="size-4" />
              الوضع
            </p>
            <SegmentedTabs
              label="وضع المتجر"
              items={MODES}
              value={theme.mode}
              onChange={(v) => set("mode", v)}
            />
          </div>
        </FormSection>

        <FormSection
          title={
            <span className="flex items-center gap-2">
              <IconPhotoPlus className="size-4" />
              صورة الغلاف
            </span>
          }
          description="تظهر خلف اسم المتجر في أعلى الصفحة الرئيسية. صورة عريضة لمحلك أو منتجاتك (الأفضل 1200×500 تقريباً)."
        >
          <div className="flex flex-wrap items-center gap-3">
            <StoreImage
              base={imageBase}
              id={theme.coverImageId}
              previewUrl={theme.coverImageId ? coverPreview : null}
              name="الغلاف"
              className="aspect-12/5 w-48 shrink-0 border"
            />
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={() => void uploadCover()}
              >
                {busy ? (
                  <IconLoader2 className="size-4 animate-spin" />
                ) : (
                  <IconPhotoPlus className="size-4" />
                )}
                {theme.coverImageId ? "تغيير الغلاف" : "رفع غلاف"}
              </Button>
              {theme.coverImageId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-destructive"
                  onClick={() => {
                    setCoverPreview(null);
                    set("coverImageId", null);
                  }}
                >
                  <IconTrash className="size-4" />
                  إزالة
                </Button>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection
          title={
            <span className="flex items-center gap-2">
              <IconSpeakerphone className="size-4" />
              الإعلان والأقسام
            </span>
          }
        >
          <FormField
            id="th-ann"
            label="شريط إعلان أعلى المتجر (اختياري)"
            hint={`${(theme.announcement ?? "").length}/140 · مثال: توصيل مجاني للطلبات فوق 500 جنيه`}
          >
            <Input
              id="th-ann"
              value={theme.announcement ?? ""}
              maxLength={140}
              onChange={(e) => set("announcement", e.target.value)}
            />
          </FormField>
          <SwitchField
            id="th-featured"
            label="قسم «مختارات المتجر»"
            description="الأصناف المميزة بالنجمة في أعلى الصفحة الرئيسية."
            checked={theme.showFeatured}
            onCheckedChange={(v) => set("showFeatured", v)}
          />
        </FormSection>

        <FormSection
          title="روابط التواصل"
          description="تظهر أيقوناتها أسفل كل صفحات المتجر."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {SOCIAL.map((s) => (
              <FormField
                key={s.key}
                id={`th-${s.key}`}
                label={
                  <span className="flex items-center gap-1.5">
                    {s.icon}
                    {s.label}
                  </span>
                }
                error={errors[s.key]}
              >
                <Input
                  id={`th-${s.key}`}
                  dir="ltr"
                  value={theme[s.key] ?? ""}
                  maxLength={200}
                  placeholder={s.placeholder}
                  onChange={(e) => set(s.key, e.target.value)}
                  aria-invalid={Boolean(errors[s.key])}
                  className="text-start"
                />
              </FormField>
            ))}
          </div>
        </FormSection>

        <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-background/95 py-3 backdrop-blur">
          {dirty && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTheme(store.theme);
                setCoverPreview(null);
              }}
            >
              تراجع
            </Button>
          )}
          <Button
            size="lg"
            className="h-10 gap-2"
            disabled={!dirty || invalid || busy || save.isPending}
            onClick={() => save.mutate(theme)}
          >
            {save.isPending ? (
              <SavingLabel />
            ) : (
              <>
                <IconDeviceFloppy className="size-4" />
                حفظ المظهر
              </>
            )}
          </Button>
        </div>
      </div>

      <Preview
        store={store}
        theme={theme}
        imageBase={imageBase}
        coverPreview={theme.coverImageId ? coverPreview : null}
      />
    </div>
  );
}
