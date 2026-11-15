/** قائمة الفروع المسموحة مع حالة كل فرع و«آخر اتصال من الفرع» (الفرع قد يعمل بلا إنترنت). */
import { StyleSheet, View } from "react-native";

import type { MobileBranch } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { StatusDot } from "@/components/shared/StatusDot";
import { useNow } from "@/hooks/useNow";
import { formatTimeAgo } from "@/lib/format";
import { space } from "@/theme/colors";

export function BranchList({ branches }: { branches: MobileBranch[] }) {
  const now = useNow();
  return (
    <View style={styles.list}>
      {branches.map((b) => (
        <Card key={b.id} style={styles.card}>
          <StatusDot online={b.online} />
          <View style={styles.text}>
            <AppText weight="semibold">
              {b.name}
              {!b.is_active && <AppText tone="muted" size="sm">{"  (موقوف)"}</AppText>}
            </AppText>
            <AppText size="xs" tone="muted">
              {b.online
                ? "متصل الآن"
                : b.last_seen_at
                  ? `آخر اتصال من الفرع: ${formatTimeAgo(b.last_seen_at, now)}`
                  : "لم يتصل الفرع بالخادم بعد"}
            </AppText>
          </View>
          <AppText size="xs" tone="muted">
            {b.code}
          </AppText>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  card: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  text: { flex: 1, gap: 2 },
});
