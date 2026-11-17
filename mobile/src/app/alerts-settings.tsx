/**
 * إعدادات التنبيهات (لكل الحساب على كل هواتفه): كل نوع يُفعّل ويُوقف، مدة انقطاع الفرع، وساعات الهدوء.
 * إعدادات شخصية للمستخدم (لا تغيّر بيانات المحل)، والخادم يسجّل كل تغيير في سجل التدقيق «من الهاتف».
 */
import { StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type { NotificationPrefs, RecapMode } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { AppSwitch } from "@/components/shared/AppSwitch";
import { Card } from "@/components/shared/Card";
import { Chips } from "@/components/shared/Chips";
import { EmptyState } from "@/components/shared/EmptyState";
import { ListRow } from "@/components/shared/ListRow";
import { Screen } from "@/components/shared/Screen";
import { ListSkeleton } from "@/components/shared/Skeletons";
import { usePrefs, useSavePrefs } from "@/features/alerts/hooks/useAlerts";
import { PushPermissionCard } from "@/features/alerts/components/PushPermissionCard";
import { formatArabicCount } from "@/lib/format";
import { space } from "@/theme/colors";

const OFFLINE_MINUTES = [15, 30, 60, 120, 240];
const QUIET_START = ["21:00", "22:00", "23:00", "00:00"];
const QUIET_END = ["06:00", "07:00", "08:00", "09:00"];
const RECAP_MODES: RecapMode[] = ["day", "week", "both"];
const RECAP_MODE_LABEL: Record<RecapMode, string> = {
  day: "يومي",
  week: "أسبوعي",
  both: "يومي وأسبوعي",
};
const RECAP_HOURS = [20, 21, 22, 23];

function minutesLabel(m: number): string {
  if (m < 60) return `${m} دقيقة`;
  return formatArabicCount(m / 60, {
    one: "ساعة",
    two: "ساعتين",
    few: "ساعات",
    many: "ساعة",
  });
}

function timeLabel(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function AlertsSettingsRoute() {
  const q = usePrefs();
  const save = useSavePrefs();
  const p = q.data;

  const update = (patch: Partial<NotificationPrefs>) => {
    if (p) save.mutate({ ...p, ...patch });
  };

  const toggle = (
    value: boolean,
    onChange: (v: boolean) => void,
    label: string,
  ) => (
    <AppSwitch
      value={value}
      onValueChange={onChange}
      disabled={save.isPending}
      accessibilityLabel={label}
    />
  );

  const chips = <T extends string | number>(
    options: T[],
    current: T,
    render: (v: T) => string,
    onPick: (v: T) => void,
  ) => (
    <Chips
      options={options}
      value={current}
      label={render}
      onChange={onPick}
      disabled={save.isPending}
    />
  );

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <PushPermissionCard />

      {!p && q.isPending && <ListSkeleton count={3} />}
      {!p && q.isError && (
        <EmptyState
          icon="alert-circle-outline"
          title="تعذّر تحميل الإعدادات"
          description={errorMessage(q.error)}
        />
      )}
      {p && (
        <>
          <Card>
            <ListRow
              icon="swap-horizontal-outline"
              title="طلب تحويل ينتظر موافقتك"
              trailing={toggle(
                p.transfer_request.enabled,
                (v) => update({ transfer_request: { enabled: v } }),
                "طلبات التحويل",
              )}
            />
            <ListRow
              icon="receipt-outline"
              title="إيصالات إلكترونية مرفوضة"
              trailing={toggle(
                p.eta_rejected.enabled,
                (v) => update({ eta_rejected: { enabled: v } }),
                "الإيصالات المرفوضة",
              )}
            />
            <ListRow
              icon="trending-down-outline"
              title="مبيعات أقل كثيراً من المعتاد"
              subtitle="لأمس مقارنة بنفس اليوم في الأسابيع السابقة"
              trailing={toggle(
                p.low_sales.enabled,
                (v) => update({ low_sales: { enabled: v } }),
                "المبيعات الأقل من المعتاد",
              )}
            />
            <ListRow
              icon="shield-outline"
              title="عمليات حساسة"
              subtitle="خصم أو مرتجع فوق الحد، ومرتجع فاتورة كاملة"
              trailing={toggle(
                p.sensitive_op.enabled,
                (v) => update({ sensitive_op: { enabled: v } }),
                "العمليات الحساسة",
              )}
            />
            <ListRow
              icon="cash-outline"
              title="فرق نقدية كبير في وردية"
              trailing={toggle(
                p.cash_diff.enabled,
                (v) => update({ cash_diff: { enabled: v } }),
                "فروق النقدية",
              )}
            />
            <ListRow
              icon="cloud-offline-outline"
              title="فرع غير متصل"
              trailing={toggle(
                p.branch_offline.enabled,
                (v) =>
                  update({
                    branch_offline: { ...p.branch_offline, enabled: v },
                  }),
                "الفرع غير المتصل",
              )}
            />
            {p.branch_offline.enabled && (
              <View style={styles.sub}>
                <AppText size="xs" tone="muted">
                  نبّهني لو انقطع الفرع أكثر من:
                </AppText>
                {chips(
                  OFFLINE_MINUTES,
                  p.branch_offline.minutes,
                  minutesLabel,
                  (m) =>
                    update({
                      branch_offline: { ...p.branch_offline, minutes: m },
                    }),
                )}
              </View>
            )}
          </Card>

          <Card>
            <ListRow
              icon="sparkles-outline"
              title="ملخص المبيعات"
              subtitle="عرض سريع بالشرائح لأرقامك مع تحليل وملاحظات. الأسبوعي يصل كل جمعة"
              trailing={toggle(
                p.recap.enabled,
                (v) => update({ recap: { ...p.recap, enabled: v } }),
                "ملخص المبيعات",
              )}
            />
            {p.recap.enabled && (
              <View style={styles.sub}>
                {chips(
                  RECAP_MODES,
                  p.recap.mode,
                  (m) => RECAP_MODE_LABEL[m],
                  (m) => update({ recap: { ...p.recap, mode: m } }),
                )}
                <AppText size="xs" tone="muted">
                  وقت الإرسال
                </AppText>
                {chips(
                  RECAP_HOURS,
                  p.recap.hour,
                  (h) => timeLabel(`${h}:00`),
                  (h) => update({ recap: { ...p.recap, hour: h } }),
                )}
              </View>
            )}
          </Card>

          <Card>
            <ListRow
              icon="moon-outline"
              title="ساعات الهدوء"
              subtitle="لا إشعارات على الهاتف خلالها، وتصلك مجمّعة بعدها"
              trailing={toggle(
                p.quiet.enabled,
                (v) => update({ quiet: { ...p.quiet, enabled: v } }),
                "ساعات الهدوء",
              )}
            />
            {p.quiet.enabled && (
              <View style={styles.sub}>
                <AppText size="xs" tone="muted">
                  من
                </AppText>
                {chips(QUIET_START, p.quiet.start, timeLabel, (v) =>
                  update({ quiet: { ...p.quiet, start: v } }),
                )}
                <AppText size="xs" tone="muted">
                  إلى
                </AppText>
                {chips(QUIET_END, p.quiet.end, timeLabel, (v) =>
                  update({ quiet: { ...p.quiet, end: v } }),
                )}
              </View>
            )}
          </Card>

          <AppText size="xs" tone="muted">
            الإعدادات لحسابك على كل هواتفك. الإشعار يظهر على شاشة القفل، لذلك لا
            يحوي مبالغ أو تفاصيل: افتح التطبيق لرؤيتها.
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { gap: space.xs, paddingBottom: space.sm },
});
