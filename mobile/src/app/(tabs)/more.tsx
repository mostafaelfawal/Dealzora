/** المزيد: حسابي، القفل بالبصمة، الخادم، الإصدار. */
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Switch } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { ListRow } from "@/components/shared/ListRow";
import { Screen } from "@/components/shared/Screen";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLockSettings } from "@/features/lock/hooks/useLockSettings";
import { getServerUrl } from "@/lib/serverUrl";
import { useTheme } from "@/theme/ThemeProvider";

export default function MoreRoute() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const lock = useLockSettings();
  const [server, setServer] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    void getServerUrl().then(setServer);
  }, []);

  async function onToggle(next: boolean) {
    setToggling(true);
    try {
      if (!(await lock.toggle(next))) Alert.alert("لم يتم التغيير", `تأكيد ${lock.label} مطلوب لتغيير القفل.`);
    } finally {
      setToggling(false);
    }
  }

  return (
    <Screen>
      <Card>
        <ListRow icon="person-circle-outline" title="حسابي" subtitle={user?.username} onPress={() => router.push("/account")} />
      </Card>

      <Card>
        <ListRow
          icon="finger-print-outline"
          title={`القفل بـ${lock.label}`}
          subtitle={
            lock.available
              ? "عند فتح التطبيق وبعد دقيقة في الخلفية"
              : "سجّل بصمة أو وجهاً في إعدادات الهاتف لتفعيله"
          }
          trailing={
            <Switch
              value={lock.enabled}
              onValueChange={onToggle}
              disabled={!lock.available || lock.loading || toggling}
              trackColor={{ true: colors.primary, false: colors.muted }}
              accessibilityLabel="القفل بالبصمة"
            />
          }
        />
      </Card>

      <Card>
        <ListRow icon="server-outline" title="خادم المزامنة" subtitle={server?.replace(/^https?:\/\//, "") ?? "—"} />
        <AppText size="xs" tone="muted">
          الإصدار {Constants.expoConfig?.version ?? "—"}
        </AppText>
      </Card>
    </Screen>
  );
}
