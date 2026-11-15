/** الرئيسية: ترحيب + ملخص حالة الفروع. ملخصات المبيعات تأتي في المراحل القادمة. */
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { Screen } from "@/components/shared/Screen";
import { ROLE_LABEL } from "@/features/account/lib/roles";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { refreshUser } from "@/features/auth/lib/session";
import { useBranches } from "@/features/branches/hooks/useBranches";
import { space } from "@/theme/colors";

export default function HomeRoute() {
  const { user } = useAuth();
  const branches = useBranches();
  const list = branches.data ?? [];
  const online = list.filter((b) => b.online).length;

  const refresh = () => {
    void refreshUser().catch(() => undefined);
    void branches.refetch();
  };

  return (
    <Screen onRefresh={refresh} refreshing={branches.isRefetching}>
      <View style={styles.hello}>
        <AppText weight="bold" size="xl">
          أهلاً {user?.username ?? ""}
        </AppText>
        {user && (
          <AppText tone="muted" size="sm">
            {ROLE_LABEL[user.role]} · {user.shop_name}
          </AppText>
        )}
      </View>

      <Card>
        <AppText tone="muted" size="sm">
          الفروع المتصلة الآن
        </AppText>
        <AppText weight="bold" size="xxl">
          {branches.data ? `${online} / ${list.length}` : "—"}
        </AppText>
        <LastUpdated at={branches.dataUpdatedAt} />
      </Card>

      <EmptyState
        icon="bar-chart-outline"
        title="ملخص المبيعات قريباً"
        description="مبيعات اليوم لكل فرع مع وقت آخر تحديث من الفرع، في التحديث القادم"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { gap: 2, marginBottom: space.xs },
});
