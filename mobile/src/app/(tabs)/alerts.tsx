/** التنبيهات: السجل (الأحدث أولاً)، والضغط يفتح الشاشة المعنية، والإعدادات من الزر أعلى الشاشة. */
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type { AppNotification, NotificationKind } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { FadeIn, PressableScale } from "@/components/shared/Motion";
import { Screen } from "@/components/shared/Screen";
import { ListSkeleton } from "@/components/shared/Skeletons";
import { PushPermissionCard } from "@/features/alerts/components/PushPermissionCard";
import {
  useMarkRead,
  useNotifications,
} from "@/features/alerts/hooks/useAlerts";
import { safeRoute } from "@/features/alerts/lib/routes";
import { useNow } from "@/hooks/useNow";
import { formatTimeAgo } from "@/lib/format";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

const ICON: Record<NotificationKind, ComponentProps<typeof Ionicons>["name"]> =
  {
    branch_offline: "cloud-offline-outline",
    eta_rejected: "receipt-outline",
    transfer_request: "swap-horizontal-outline",
    low_sales: "trending-down-outline",
    sensitive_op: "shield-outline",
    cash_diff: "cash-outline",
    recap: "sparkles-outline",
    test: "flask-outline",
  };

export default function AlertsRoute() {
  const { colors } = useTheme();
  const q = useNotifications();
  const read = useMarkRead();
  const now = useNow();
  const items = q.data?.items ?? [];

  const openItem = (n: AppNotification) => {
    if (!n.read_at) read.mutate([n.id]);
    const route = safeRoute(n.route);
    if (route && route !== "/alerts") router.push(route as never);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إعدادات التنبيهات"
              hitSlop={10}
              onPress={() => router.push("/alerts-settings")}
              style={styles.headerBtn}
            >
              <Ionicons
                name="settings-outline"
                size={22}
                color={colors.foreground}
              />
            </Pressable>
          ),
        }}
      />
      <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
        <PushPermissionCard compact />
        {(q.data?.unread ?? 0) > 0 && (
          <Button
            title="تعليم الكل كمقروء"
            variant="secondary"
            icon="checkmark-done-outline"
            onPress={() => read.mutate(undefined)}
            loading={read.isPending}
          />
        )}
        {items.map((n, i) => (
          <FadeIn key={n.id} index={i}>
            <PressableScale
              accessibilityRole="button"
              scaleTo={0.985}
              onPress={() => openItem(n)}
            >
              {/* غير المقروء: شريط في بداية البطاقة + عنوان عريض + نقطة */}
              <Card
                style={[
                  styles.row,
                  {
                    borderStartColor: n.read_at
                      ? colors.border
                      : colors.foreground,
                  },
                ]}
              >
                <View
                  style={[styles.iconTile, { backgroundColor: colors.muted }]}
                >
                  <Ionicons
                    name={ICON[n.kind]}
                    size={20}
                    color={
                      n.read_at ? colors.mutedForeground : colors.foreground
                    }
                  />
                </View>
                <View style={styles.flex}>
                  <View style={styles.titleRow}>
                    <AppText
                      weight={n.read_at ? "medium" : "bold"}
                      style={styles.flex}
                    >
                      {n.title}
                    </AppText>
                    {!n.read_at && (
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: colors.destructive },
                        ]}
                        accessibilityLabel="غير مقروء"
                      />
                    )}
                  </View>
                  <AppText size="sm" tone="muted">
                    {n.body}
                  </AppText>
                  <AppText size="xs" tone="muted">
                    {formatTimeAgo(n.created_at, now)}
                    {n.status === "pending"
                      ? " · سيُرسل للهاتف بعد ساعات الهدوء"
                      : ""}
                  </AppText>
                </View>
              </Card>
            </PressableScale>
          </FadeIn>
        ))}
        {q.isPending && <ListSkeleton />}
        {q.isError && !q.data && (
          <EmptyState
            icon="alert-circle-outline"
            title="تعذّر تحميل التنبيهات"
            description={errorMessage(q.error)}
          />
        )}
        {q.data && items.length === 0 && (
          <EmptyState
            icon="notifications-off-outline"
            title="لا تنبيهات"
            description="فرع انقطع، طلب تحويل ينتظر موافقتك، إيصالات مرفوضة، أو مبيعات أقل من المعتاد: تظهر هنا"
          />
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: space.md,
    alignItems: "flex-start",
    paddingVertical: space.md,
    borderStartWidth: 3,
  },
  iconTile: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headerBtn: { paddingHorizontal: space.lg },
});
