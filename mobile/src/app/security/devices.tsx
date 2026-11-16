/**
 * أجهزة الفروع (المالك فقط): إلغاء ربط جهاز مسروق/مفقود (يتوقف فوراً)، وكود ربط لجهاز جديد.
 * الجهاز الرئيسي يُلغى من هنا لو اتسرق، ويُسترجع بمفتاح الترخيص على جهاز جديد (لا كود ربط له).
 */
import { useState } from "react";
import { Alert, Share, StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type { BranchDevice, PairingCode } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { Screen } from "@/components/shared/Screen";
import { Sheet } from "@/components/shared/Sheet";
import { ListSkeleton } from "@/components/shared/Skeletons";
import { BranchStatusBadge } from "@/features/branches/components/BranchStatusBadge";
import { statusText } from "@/features/dashboard/lib/insights";
import { OwnerOnly } from "@/features/security/components/OwnerOnly";
import { useDevices, usePairingCode, useRevokeDevice } from "@/features/security/hooks/useSecurity";
import { useOnline } from "@/hooks/useOnline";
import { formatDateTime } from "@/lib/format";
import { radius, space } from "@/theme/colors";
import { fontFamily } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";

export default function DevicesRoute() {
  return (
    <OwnerOnly>
      <DevicesScreen />
    </OwnerOnly>
  );
}

function DevicesScreen() {
  const q = useDevices();
  const revoke = useRevokeDevice();
  const pairing = usePairingCode();
  const online = useOnline();
  const [code, setCode] = useState<PairingCode | null>(null);

  const confirmRevoke = (d: BranchDevice) =>
    Alert.alert(
      `إلغاء ربط جهاز «${d.name}»؟`,
      d.is_admin
        ? "هذا هو الجهاز الرئيسي (جهازك). يتوقف فوراً عن المزامنة وإدارة الفروع، ولا يرجع إلا بإدخال مفتاح الترخيص على جهاز جديد («استرجاع المحل»). استخدمه فقط لو الجهاز اتسرق أو ضاع."
        : "الجهاز يتوقف فوراً عن المزامنة. لربط جهاز جديد للفرع اطلب كود ربط بعدها.",
      [
        { text: "رجوع", style: "cancel" },
        { text: "إلغاء الربط", style: "destructive", onPress: () => revoke.mutate(d.id) },
      ],
    );

  const confirmPairing = (d: BranchDevice) =>
    Alert.alert(
      `كود ربط جديد لفرع «${d.name}»؟`,
      d.paired
        ? "عند استخدام الكود يتوقف الجهاز المربوط حالياً بهذا الفرع ويحل محله الجهاز الجديد."
        : "اكتب الكود في البرنامج على جهاز الفرع (فرع تابع). صالح 15 دقيقة ومرة واحدة.",
      [
        { text: "رجوع", style: "cancel" },
        { text: "إصدار الكود", onPress: () => pairing.mutate(d.id, { onSuccess: setCode }) },
      ],
    );

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <LastUpdated at={q.dataUpdatedAt} />
      {q.data?.map((d) => (
        <Card key={d.id}>
          <View style={styles.head}>
            <AppText weight="semibold" style={styles.flex}>
              {d.name}
              {d.is_admin ? "  (الجهاز الرئيسي)" : ""}
            </AppText>
            <BranchStatusBadge status={d.status} />
          </View>
          <AppText size="xs" tone="muted">
            {d.paired ? statusText(d.status, d.seconds_since_seen) : "لا يوجد جهاز مربوط حالياً"}
          </AppText>
          <View style={styles.actions}>
            {d.paired && (
              <Button
                title="إلغاء ربط الجهاز"
                icon="phone-portrait-outline"
                variant="destructive"
                onPress={() => confirmRevoke(d)}
                loading={revoke.isPending && revoke.variables === d.id}
                disabled={!online || revoke.isPending}
                style={styles.flex}
              />
            )}
            {!d.is_admin && d.is_active && (
              <Button
                title="كود ربط"
                icon="key-outline"
                variant="secondary"
                onPress={() => confirmPairing(d)}
                loading={pairing.isPending && pairing.variables === d.id}
                disabled={!online || pairing.isPending}
                style={styles.flex}
              />
            )}
          </View>
        </Card>
      ))}
      {q.isPending && <ListSkeleton count={3} />}
      {q.isError && !q.data && <EmptyState icon="alert-circle-outline" title="تعذّر التحميل" description={errorMessage(q.error)} />}
      {code && <CodeSheet code={code} onClose={() => setCode(null)} />}
    </Screen>
  );
}

function CodeSheet({ code, onClose }: { code: PairingCode; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Sheet title={`كود ربط فرع «${code.branch_name}»`} onClose={onClose}>
      <View style={[styles.codeBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
        <AppText selectable center style={styles.code}>
          {code.code}
        </AppText>
      </View>
      <AppText size="sm" tone="muted" center>
        صالح حتى {formatDateTime(code.expires_at)} ولمرة واحدة. يكتبه الموظف في البرنامج على جهاز الفرع («فرع تابع»).
      </AppText>
      <Button
        title="مشاركة الكود"
        icon="share-outline"
        variant="secondary"
        onPress={() => void Share.share({ message: `كود ربط فرع ${code.branch_name} في Dealzora: ${code.code}` })}
      />
      <Button title="تم" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  codeBox: { borderWidth: 1, borderRadius: radius.md, paddingVertical: space.lg },
  code: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 40, letterSpacing: 2, writingDirection: "ltr" },
});
