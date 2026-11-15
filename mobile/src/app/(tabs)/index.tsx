/** الرئيسية: لوحة الفترة لكل الفروع المسموحة (المالك = كل المحل، المدير = فروعه). */
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { Screen } from "@/components/shared/Screen";
import { ROLE_LABEL } from "@/features/account/lib/roles";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { refreshUser } from "@/features/auth/lib/session";
import { DashboardBody } from "@/features/dashboard/components/DashboardBody";
import { useSummary } from "@/features/dashboard/hooks/useSummary";
import { usePeriod } from "@/features/dashboard/lib/periodStore";
import { space } from "@/theme/colors";

export default function HomeRoute() {
  const { user } = useAuth();
  const { preset, range } = usePeriod();
  const summary = useSummary(range);

  const refresh = () => {
    void refreshUser().catch(() => undefined);
    void summary.refetch();
  };

  return (
    <Screen onRefresh={refresh} refreshing={summary.isRefetching && !summary.isPlaceholderData}>
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
      <DashboardBody query={summary} preset={preset} range={range} showRanking />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { gap: 2, marginBottom: space.xs },
});
