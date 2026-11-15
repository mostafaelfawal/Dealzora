/**
 * حدود العمليات الحساسة وفرق النقدية وأيام الصلاحية (المالك فقط). تصل للفروع مع مزامنتها التالية،
 * والخادم يسجّل التغيير في سجل التدقيق «من الهاتف».
 */
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet } from "react-native";

import { errorMessage } from "@/api/errors";
import type { ReportConfig } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Screen } from "@/components/shared/Screen";
import { TextField } from "@/components/shared/TextField";
import { useReportConfig, useSaveReportConfig } from "@/features/reports/hooks/useReports";
import { parseMoneyInput } from "@/features/reports/lib/reportText";
import { OwnerOnly } from "@/features/security/components/OwnerOnly";
import { useIsOwner } from "@/features/security/hooks/useSecurity";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

const MONEY_FIELDS: { key: keyof ReportConfig; label: string; hint: string }[] = [
  { key: "discount_min", label: "خصم الكاشير على فاتورة (ج.م)", hint: "خصم أسطر + فاتورة بهذا المبلغ أو أكثر = عملية حساسة" },
  { key: "return_min", label: "المرتجع (ج.م)", hint: "مرتجع بهذا المبلغ أو أكثر = عملية حساسة (المرتجع الكامل دائماً)" },
  { key: "cash_diff_min", label: "فرق نقدية الوردية (ج.م)", hint: "عجز أو زيادة بهذا المبلغ أو أكثر = تنبيه" },
];
const EXPIRY_DAYS = [7, 14, 30, 60, 90];

export default function ReportSettingsRoute() {
  return (
    <OwnerOnly>
      <ReportSettings />
    </OwnerOnly>
  );
}

function ReportSettings() {
  const owner = useIsOwner();
  const q = useReportConfig(owner);
  if (!q.data) {
    return (
      <Screen>
        {q.isPending ? <AppText tone="muted">جارٍ التحميل…</AppText> : <EmptyState icon="alert-circle-outline" title="تعذّر التحميل" description={errorMessage(q.error)} />}
      </Screen>
    );
  }
  // النموذج يبدأ من القيم المحفوظة (ويُعاد بناؤه لو تغيّرت من جهاز آخر).
  return <ReportForm key={q.dataUpdatedAt} initial={q.data} />;
}

function ReportForm({ initial }: { initial: ReportConfig }) {
  const { colors } = useTheme();
  const save = useSaveReportConfig();
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(MONEY_FIELDS.map((f) => [f.key, String(initial[f.key] / 100)])),
  );
  const [days, setDays] = useState(initial.expiry_days);

  const parsed = MONEY_FIELDS.map((f) => ({ f, v: parseMoneyInput(text[f.key] ?? "") }));
  const invalid = parsed.some((p) => p.v === null);

  const submit = () => {
    const next = { ...Object.fromEntries(parsed.map((p) => [p.f.key, p.v ?? 0])), expiry_days: days } as unknown as ReportConfig;
    Alert.alert("حفظ الحدود", "تسري على كل الفروع بعد مزامنتها التالية (خلال دقائق والبرنامج مفتوح).", [
      { text: "رجوع", style: "cancel" },
      { text: "حفظ", onPress: () => save.mutate(next, { onSuccess: () => Alert.alert("تم الحفظ") }) },
    ]);
  };

  return (
    <Screen>
      <Card>
        {MONEY_FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            hint={f.hint}
            value={text[f.key] ?? ""}
            onChangeText={(v) => setText((s) => ({ ...s, [f.key]: v }))}
            keyboardType="decimal-pad"
            ltr
            error={parseMoneyInput(text[f.key] ?? "") === null ? "مبلغ غير صالح" : null}
          />
        ))}
      </Card>
      <Card>
        <AppText weight="medium" size="sm">
          «قريب من الانتهاء» خلال
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {EXPIRY_DAYS.map((d) => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: d === days }}
              onPress={() => setDays(d)}
              style={[styles.chip, { backgroundColor: d === days ? colors.primary : colors.secondary, borderColor: d === days ? colors.primary : colors.border }]}
            >
              <AppText size="sm" style={{ color: d === days ? colors.primaryForeground : colors.foreground }}>
                {d} يوم
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </Card>
      <Button title="حفظ الحدود" icon="save-outline" onPress={submit} loading={save.isPending} disabled={invalid} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space.md, minHeight: 34, justifyContent: "center" },
});
