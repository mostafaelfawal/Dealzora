/** الرئيسية: لوحة الفترة لكل الفروع المسموحة (المالك = كل المحل، المدير = فروعه). */
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { BrandLogo } from "@/components/shared/BrandLogo";
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
      <View style={styles.top}>
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
        <BrandLogo width={104} style={styles.logo} />
      </View>
      <DashboardBody query={summary} preset={preset} range={range} showRanking />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // الترحيب في بداية السطر والشعار في نهايته
  top: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.xs },
  hello: { flex: 1, gap: 2 },
  logo: { alignSelf: "auto" },
});
