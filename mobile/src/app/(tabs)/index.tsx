/** الرئيسية: لوحة الفترة لكل الفروع المسموحة (المالك = كل المحل، المدير = فروعه). */
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { FadeIn } from "@/components/shared/Motion";
import { Screen } from "@/components/shared/Screen";
import { ROLE_LABEL } from "@/features/account/lib/roles";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { refreshUser } from "@/features/auth/lib/session";
import { DashboardBody } from "@/features/dashboard/components/DashboardBody";
import { useSummary } from "@/features/dashboard/hooks/useSummary";
import { usePeriod } from "@/features/dashboard/lib/periodStore";
import { useNow } from "@/hooks/useNow";
import { space } from "@/theme/colors";

const todayFormat = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** صباح الخير حتى 12 ظهراً، ثم مساء الخير. */
const greeting = (now: number) =>
  new Date(now).getHours() < 12 ? "صباح الخير" : "مساء الخير";

export default function HomeRoute() {
  const { user } = useAuth();
  const { preset, range } = usePeriod();
  const summary = useSummary(range);
  const now = useNow();

  const refresh = () => {
    void refreshUser().catch(() => undefined);
    void summary.refetch();
  };

  return (
    <Screen
      onRefresh={refresh}
      refreshing={summary.isRefetching && !summary.isPlaceholderData}
    >
      <FadeIn style={styles.top}>
        <View style={styles.hello}>
          <AppText size="xs" tone="muted" weight="medium">
            {todayFormat.format(now)}
          </AppText>
          <AppText
            weight="bold"
            size="xxl"
            numberOfLines={1}
            style={styles.title}
          >
            {greeting(now)}، {user?.username ?? ""}
          </AppText>
          {user && (
            <AppText tone="muted" size="sm" numberOfLines={1}>
              {ROLE_LABEL[user.role]} · {user.shop_name}
            </AppText>
          )}
        </View>
        <BrandLogo width={88} style={styles.logo} />
      </FadeIn>
      <DashboardBody
        query={summary}
        preset={preset}
        range={range}
        showRanking
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // الترحيب في بداية السطر والشعار في نهايته
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginBottom: space.sm,
  },
  hello: { flex: 1 },
  title: { lineHeight: 38 },
  logo: { alignSelf: "auto" },
});
