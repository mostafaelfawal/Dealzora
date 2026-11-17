/** جلسات تطبيق الهاتف لكل مستخدمي المحل (المالك فقط): عرض وإلغاء جلسة بتأكيد صريح. */
import { Alert, StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type { ShopSession } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { Screen } from "@/components/shared/Screen";
import { ListSkeleton } from "@/components/shared/Skeletons";
import { OwnerOnly } from "@/features/security/components/OwnerOnly";
import {
  useRevokeShopSession,
  useShopSessions,
} from "@/features/security/hooks/useSecurity";
import { useNow } from "@/hooks/useNow";
import { useOnline } from "@/hooks/useOnline";
import { formatTimeAgo } from "@/lib/format";
import { space } from "@/theme/colors";

export default function SessionsRoute() {
  return (
    <OwnerOnly>
      <SessionsScreen />
    </OwnerOnly>
  );
}

function SessionsScreen() {
  const q = useShopSessions();
  const revoke = useRevokeShopSession();
  const online = useOnline();
  const now = useNow();

  const confirm = (s: ShopSession) =>
    Alert.alert(
      `إلغاء جلسة «${s.username}»؟`,
      s.is_current
        ? "هذا هاتفك أنت: ستخرج منه الآن وتحتاج كود ربط جديد للدخول."
        : `يخرج ${s.username} من تطبيق الهاتف على «${s.device_name}» فوراً، ويحتاج كود ربط جديد للدخول.`,
      [
        { text: "رجوع", style: "cancel" },
        {
          text: "إلغاء الجلسة",
          style: "destructive",
          onPress: () => revoke.mutate(s.id),
        },
      ],
    );

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <LastUpdated at={q.dataUpdatedAt} />
      {q.data?.map((s) => (
        <Card key={s.id}>
          <View style={styles.head}>
            <View style={styles.flex}>
              <AppText weight="semibold">
                {s.username}
                {s.is_current ? "  (هذا الهاتف)" : ""}
              </AppText>
              <AppText size="xs" tone="muted">
                {s.device_name} · آخر استخدام{" "}
                {formatTimeAgo(s.last_used_at ?? s.created_at, now)}
              </AppText>
            </View>
          </View>
          <Button
            title="إلغاء الجلسة"
            icon="log-out-outline"
            variant="destructive"
            onPress={() => confirm(s)}
            loading={revoke.isPending && revoke.variables === s.id}
            disabled={!online || revoke.isPending}
          />
        </Card>
      ))}
      {q.isPending && <ListSkeleton count={3} />}
      {q.isError && !q.data && (
        <EmptyState
          icon="alert-circle-outline"
          title="تعذّر التحميل"
          description={errorMessage(q.error)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
});
