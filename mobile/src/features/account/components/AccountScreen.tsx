/**
 * «حسابي»: بيانات الحساب، الهواتف المسجّلة، تسجيل الخروج، والخروج من كل الأجهزة.
 * كل إجراء يغيّر بيانات: تأكيد صريح، والخادم يسجّله في سجل التدقيق باسم المستخدم والجهاز.
 */
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { ListRow } from "@/components/shared/ListRow";
import { Screen } from "@/components/shared/Screen";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { signOut, signOutEverywhere } from "@/features/auth/lib/session";
import { useOnline } from "@/hooks/useOnline";
import { formatTimeAgo } from "@/lib/format";
import { space } from "@/theme/colors";

import { useSessions } from "../hooks/useSessions";
import { ROLE_LABEL } from "../lib/roles";

const PLATFORM_ICON = { android: "logo-android", ios: "logo-apple" } as const;

export function AccountScreen() {
  const { user } = useAuth();
  const online = useOnline();
  const sessions = useSessions();
  const [busy, setBusy] = useState<"one" | "all" | null>(null);

  const confirmLogout = () =>
    Alert.alert(
      "تسجيل الخروج",
      "سيتم الخروج من هذا الهاتف فقط. ستحتاج كود ربط جديد للدخول مرة أخرى.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تسجيل الخروج",
          style: "destructive",
          onPress: async () => {
            setBusy("one");
            try {
              await signOut();
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );

  const confirmLogoutAll = () =>
    Alert.alert(
      "الخروج من كل الأجهزة",
      "سيتم الخروج من كل الهواتف المسجّلة بحسابك، ومنها هذا الهاتف. استخدمه لو ضاع هاتف أو شككت في دخول غيرك.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "الخروج من الكل",
          style: "destructive",
          onPress: async () => {
            setBusy("all");
            try {
              await signOutEverywhere();
            } catch (e) {
              Alert.alert("تعذّر الخروج من كل الأجهزة", errorMessage(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );

  return (
    <Screen
      onRefresh={() => void sessions.refetch()}
      refreshing={sessions.isRefetching}
    >
      <Card>
        <AppText weight="bold" size="lg">
          {user?.username ?? "—"}
        </AppText>
        <AppText tone="muted" size="sm">
          {user ? `${ROLE_LABEL[user.role]} · ${user.shop_name}` : ""}
        </AppText>
      </Card>

      <View style={styles.sectionHead}>
        <AppText weight="semibold">الأجهزة المسجّلة</AppText>
        <LastUpdated at={sessions.dataUpdatedAt} />
      </View>
      <Card>
        {sessions.data?.map((s) => (
          <ListRow
            key={s.id}
            icon={
              PLATFORM_ICON[s.platform as keyof typeof PLATFORM_ICON] ??
              "phone-portrait-outline"
            }
            title={
              s.is_current ? `${s.device_name} (هذا الهاتف)` : s.device_name
            }
            subtitle={`آخر استخدام: ${formatTimeAgo(s.last_used_at ?? s.created_at)}`}
          />
        ))}
        {!sessions.data && sessions.isPending && (
          <AppText tone="muted" size="sm">
            جارٍ التحميل…
          </AppText>
        )}
        {sessions.isError && !sessions.data && (
          <AppText tone="destructive" size="sm">
            {errorMessage(sessions.error)}
          </AppText>
        )}
      </Card>

      <View style={styles.actions}>
        <Button
          title="تسجيل الخروج من هذا الهاتف"
          icon="log-out-outline"
          variant="secondary"
          onPress={confirmLogout}
          loading={busy === "one"}
          disabled={busy !== null}
        />
        <Button
          title="الخروج من كل الأجهزة"
          icon="shield-outline"
          variant="destructive"
          onPress={confirmLogoutAll}
          loading={busy === "all"}
          disabled={busy !== null || !online}
        />
        {!online && (
          <AppText size="xs" tone="muted" center>
            الخروج من كل الأجهزة يحتاج اتصالاً بالإنترنت
          </AppText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHead: { gap: 2, marginTop: space.sm },
  actions: { gap: space.sm, marginTop: space.md },
});
