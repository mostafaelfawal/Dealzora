/**
 * الموظفون (المالك فقط): إيقاف حساب موظف فوراً بتأكيد صريح. الإيقاف يصل لأجهزة الفروع مع المزامنة
 * (عادة خلال دقيقة والبرنامج مفتوح)، فلا يدخل الموظف، وجلسته المفتوحة تُقفل.
 */
import { Alert, StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type { StaffMember } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { Screen } from "@/components/shared/Screen";
import { useOnline } from "@/hooks/useOnline";
import { OwnerOnly } from "@/features/security/components/OwnerOnly";
import { useSetStaffActive, useStaff } from "@/features/security/hooks/useSecurity";
import { space } from "@/theme/colors";

const ROLE: Record<string, string> = { manager: "مدير فرع", cashier: "كاشير" };

export default function StaffRoute() {
  return (
    <OwnerOnly>
      <StaffScreen />
    </OwnerOnly>
  );
}

function StaffScreen() {
  const q = useStaff();
  const toggle = useSetStaffActive();
  const online = useOnline();
  const rows = [...(q.data ?? [])].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.username.localeCompare(b.username));

  const confirm = (s: StaffMember) => {
    const branches = s.branches.map((b) => b.name).join("، ");
    if (s.is_active) {
      Alert.alert(
        `إيقاف «${s.username}»؟`,
        `لن يستطيع الدخول على أجهزة ${branches} بعد مزامنتها (عادة خلال دقيقة والبرنامج مفتوح)، وتُقفل جلسته المفتوحة.` +
          (s.role === "manager" ? " ويتوقف تطبيق الهاتف عنده فوراً." : ""),
        [
          { text: "رجوع", style: "cancel" },
          { text: "إيقاف الحساب", style: "destructive", onPress: () => toggle.mutate({ id: s.id, active: false }) },
        ],
      );
    } else {
      Alert.alert(`إعادة تفعيل «${s.username}»؟`, `يقدر يدخل على أجهزة ${branches} من جديد بعد مزامنتها.`, [
        { text: "رجوع", style: "cancel" },
        { text: "تفعيل", onPress: () => toggle.mutate({ id: s.id, active: true }) },
      ]);
    }
  };

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <LastUpdated at={q.dataUpdatedAt} />
      {rows.map((s) => (
        <Card key={s.id}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <AppText weight="semibold">{s.username}</AppText>
              <AppText size="xs" tone="muted">
                {ROLE[s.role] ?? s.role} · {s.branches.map((b) => b.name).join("، ")}
              </AppText>
            </View>
            <AppText size="xs" weight="semibold" tone={s.is_active ? "success" : "destructive"}>
              {s.is_active ? "نشط" : "موقوف"}
            </AppText>
          </View>
          <Button
            title={s.is_active ? "إيقاف الحساب" : "إعادة التفعيل"}
            icon={s.is_active ? "ban-outline" : "checkmark-circle-outline"}
            variant={s.is_active ? "destructive" : "secondary"}
            onPress={() => confirm(s)}
            loading={toggle.isPending && toggle.variables?.id === s.id}
            disabled={!online || toggle.isPending}
          />
        </Card>
      ))}
      {q.isPending && <AppText tone="muted">جارٍ التحميل…</AppText>}
      {q.isError && !q.data && <EmptyState icon="alert-circle-outline" title="تعذّر التحميل" description={errorMessage(q.error)} />}
      {q.data && rows.length === 0 && (
        <EmptyState icon="people-outline" title="لا يوجد موظفون" description="المديرون والكاشيرية تضيفهم من البرنامج على الجهاز الرئيسي" />
      )}
      {!online && (
        <AppText size="xs" tone="muted" center>
          الإيقاف يحتاج اتصالاً بالإنترنت
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
});
