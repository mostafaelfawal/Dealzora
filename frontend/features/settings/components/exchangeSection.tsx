"use client";

import {
  IconArrowBackUp,
  IconDeviceFloppy,
  IconHandFinger,
  IconLoader2,
  IconRefresh,
  IconWorld,
} from "@tabler/icons-react";
import { useState } from "react";

import { OptionSelect } from "@/components/shared/OptionSelect";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/dates";
import { rateSentence, useExchange, type ExchangeConfig } from "@/lib/exchange";

import { ARAB_CURRENCIES } from "../config/currencies";
import {
  useRefreshExchangeRate,
  useSaveExchangeConfig,
} from "../hooks/useSettings";
import {
  ChoiceCards,
  SettingGroup,
  SettingRow,
  SwitchRow,
} from "./settingsControls";

/** عملات عالمية شائعة + العملات العربية. الكسور الافتراضية حسب العملة. */
const GLOBAL = [
  { code: "USD", symbol: "$", name: "دولار أمريكي" },
  { code: "EUR", symbol: "€", name: "يورو" },
  { code: "GBP", symbol: "£", name: "جنيه إسترليني" },
  { code: "TRY", symbol: "₺", name: "ليرة تركية" },
];
const ALL_CURRENCIES = [
  ...GLOBAL,
  ...ARAB_CURRENCIES.map(({ code, symbol, name }) => ({ code, symbol, name })),
];
/** عملات بلا كسور في التعامل اليومي. */
const NO_DECIMALS = new Set(["LBP", "SYP", "IQD", "YER", "SDG"]);

const DECIMALS = [
  { id: "0" as const, label: "بدون كسور" },
  { id: "2" as const, label: "كسرين (0.00)" },
];

/** العملة الثانية: المقابل بعملة أخرى في الكاشير والفاتورة ولوحة التحكم. */
export function ExchangeSection() {
  const main = useCurrency();
  const state = useExchange();
  const save = useSaveExchangeConfig();
  const refresh = useRefreshExchangeRate();
  const [draft, setDraft] = useState<ExchangeConfig | null>(null);

  const cfg = draft ?? state.config;
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(state.config);
  const set = (patch: Partial<ExchangeConfig>) =>
    setDraft({ ...cfg, ...patch });

  const items = ALL_CURRENCIES.filter((c) => c.code !== main.code).map((c) => ({
    value: c.code,
    label: `${c.name} (${c.symbol})`,
  }));
  const sameAsMain = cfg.code === main.code;
  const manualInvalid =
    cfg.enabled &&
    cfg.mode === "manual" &&
    !(cfg.manualRate && cfg.manualRate > 0);

  function pickCurrency(code: string) {
    const c = ALL_CURRENCIES.find((x) => x.code === code);
    if (!c) return;
    set({
      code: c.code,
      symbol: c.symbol,
      name: c.name,
      decimals: NO_DECIMALS.has(c.code) ? 0 : 2,
      manualRate: null,
    });
  }

  // السعر المعروض: من القاعدة فقط لو الإعداد المحفوظ لنفس العملة.
  const savedRate =
    state.rate && state.config.code === cfg.code ? state.rate : null;

  return (
    <div className="space-y-6">
      <SwitchRow
        id="ex-enabled"
        title="عرض الأسعار بعملة ثانية"
        description={`مثلاً: تبيع بـ${main.name} ويظهر المقابل بالدولار أو الليرة للزبون.`}
        checked={cfg.enabled}
        onChange={(enabled) =>
          set({
            enabled,
            ...(enabled && sameAsMain ? pickPatch(items[0]?.value) : {}),
          })
        }
      />

      {cfg.enabled && (
        <>
          <SettingRow
            title="العملة الثانية"
            description={`عملة محلك: ${main.name} (${main.symbol}).`}
          >
            <OptionSelect
              label="العملة الثانية"
              items={items}
              value={cfg.code}
              onChange={pickCurrency}
              className="w-64 max-w-[70vw]"
            />
          </SettingRow>

          <SettingGroup title="سعر الصرف">
            <ChoiceCards
              label="مصدر سعر الصرف"
              value={cfg.mode}
              onChange={(mode) => set({ mode })}
              className="py-3"
              items={[
                {
                  value: "auto",
                  title: "تلقائي من الإنترنت",
                  description:
                    "السعر الرسمي يتحدث وحده يومياً، ويُحفظ آخر سعر لو انقطع الإنترنت.",
                  icon: <IconWorld />,
                  badge: "موصى به",
                },
                {
                  value: "manual",
                  title: "أكتبه بنفسي",
                  description:
                    "لو تتعامل بسعر السوق (مختلف عن الرسمي). تغيّره وقتما تشاء.",
                  icon: <IconHandFinger />,
                },
              ]}
            />

            {cfg.mode === "auto" ? (
              <SettingRow
                title={
                  savedRate
                    ? rateSentence(savedRate, main, cfg).text
                    : "لا يوجد سعر بعد"
                }
                description={
                  savedRate
                    ? `آخر تحديث: ${formatDateTime(savedRate.fetchedAt)} · المصدر: ${savedRate.source}`
                    : dirty
                      ? "احفظ أولاً، وسيُجلب السعر تلقائياً."
                      : "تأكد من الإنترنت ثم اضغط «تحديث السعر»."
                }
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => refresh.mutate()}
                  disabled={refresh.isPending || dirty}
                  className="gap-2"
                >
                  {refresh.isPending ? (
                    <IconLoader2 className="size-4 animate-spin" />
                  ) : (
                    <IconRefresh className="size-4" />
                  )}
                  تحديث السعر
                </Button>
              </SettingRow>
            ) : (
              <SettingRow
                title="السعر الذي تتعامل به"
                description="اختر الاتجاه الأسهل لك، ثم اكتب الرقم."
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedTabs
                    label="اتجاه السعر"
                    items={[
                      { id: "second" as const, label: `1 ${cfg.name} =` },
                      { id: "main" as const, label: `1 ${main.name} =` },
                    ]}
                    value={cfg.manualBase}
                    onChange={(manualBase) => set({ manualBase })}
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    dir="ltr"
                    aria-label="سعر الصرف"
                    aria-invalid={manualInvalid || undefined}
                    value={cfg.manualRate ?? ""}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      set({ manualRate: e.target.value && v > 0 ? v : null });
                    }}
                    className="h-10 w-36 text-right font-mono"
                  />
                  <span className="text-sm text-muted-foreground">
                    {cfg.manualBase === "second" ? main.name : cfg.name}
                  </span>
                </div>
              </SettingRow>
            )}
          </SettingGroup>

          <SettingGroup title="أين يظهر">
            <SwitchRow
              id="ex-pos"
              title="شاشة البيع"
              description="المقابل تحت الإجمالي، والكاشير يقدر يبدّل العملة الكبيرة بضغطة."
              checked={cfg.showInPos}
              onChange={(showInPos) => set({ showInPos })}
            />
            <SwitchRow
              id="ex-receipt"
              title="الفاتورة المطبوعة"
              description="سطر «الإجمالي بالعملة الثانية» وسعر الصرف المستخدم."
              checked={cfg.showOnReceipt}
              onChange={(showOnReceipt) => set({ showOnReceipt })}
            />
            <SettingRow title="الكسور" description="الليرة عادة بدون كسور.">
              <SegmentedTabs
                label="الكسور"
                items={DECIMALS}
                value={cfg.decimals === 0 ? "0" : "2"}
                onChange={(v) => set({ decimals: Number(v) })}
              />
            </SettingRow>
          </SettingGroup>
        </>
      )}

      {dirty && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDraft(null)}
            disabled={save.isPending}
            className="gap-1.5"
          >
            <IconArrowBackUp className="size-4" />
            تراجع
          </Button>
          <Button
            type="button"
            onClick={() =>
              save.mutate(cfg, { onSuccess: () => setDraft(null) })
            }
            disabled={
              save.isPending || manualInvalid || (cfg.enabled && sameAsMain)
            }
            className="gap-1.5"
          >
            {save.isPending ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconDeviceFloppy className="size-4" />
            )}
            حفظ
          </Button>
        </div>
      )}
    </div>
  );
}

function pickPatch(code: string | undefined): Partial<ExchangeConfig> {
  const c = ALL_CURRENCIES.find((x) => x.code === code);
  return c
    ? {
        code: c.code,
        symbol: c.symbol,
        name: c.name,
        decimals: NO_DECIMALS.has(c.code) ? 0 : 2,
      }
    : {};
}
