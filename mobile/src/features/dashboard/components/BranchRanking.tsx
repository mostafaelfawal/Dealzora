/**
 * ترتيب الفروع بصافي المبيعات (نفس ترتيب تقرير الفروع). شريط أفقي لسلسلة واحدة (بلا مفتاح ألوان)،
 * والرقم مكتوب بجانب كل فرع. فرع لم يرسل بيانات الفترة: لا شريط ولا صفر، بل «لم يرسل بعد».
 * بجانب أرقام كل فرع «آخر تحديث من الفرع».
 */
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { BranchTotals } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { Money } from "@/components/shared/Money";
import { useNow } from "@/hooks/useNow";
import { formatTimeAgo } from "@/lib/format";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { branchCoverage, coverageLabel } from "../lib/insights";

interface Props {
  branches: BranchTotals[];
  singleDay: boolean;
}

export function BranchRanking({ branches, singleDay }: Props) {
  const now = useNow();
  const { chart } = useTheme();
  const max = Math.max(...branches.map((b) => b.net), 0);

  return (
    <Card>
      <AppText weight="semibold">ترتيب الفروع</AppText>
      <AppText size="xs" tone="muted">
        بصافي المبيعات، الأعلى أولاً
      </AppText>
      {branches.map((b, i) => {
        const cov = branchCoverage(b);
        const note = coverageLabel(b, singleDay);
        const share = max > 0 && b.net > 0 ? b.net / max : 0;
        return (
          <Pressable
            key={b.id}
            accessibilityRole="button"
            accessibilityHint="تفاصيل الفرع"
            onPress={() => router.push({ pathname: "/branch/[id]", params: { id: b.id } })}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
          >
            <View style={styles.head}>
              <AppText size="sm" tone="muted" style={styles.rank}>
                {cov === "none" ? "–" : i + 1}
              </AppText>
              <AppText weight="medium" style={styles.name} numberOfLines={1}>
                {b.name}
              </AppText>
              {cov === "none" ? (
                <AppText size="sm" tone="warning" weight="medium">
                  لم يرسل بعد
                </AppText>
              ) : (
                <Money amount={b.net} size="sm" weight="semibold" tone={b.net < 0 ? "destructive" : "default"} />
              )}
            </View>
            {cov !== "none" && (
              <View style={[styles.track, { backgroundColor: chart.track }]}>
                {share > 0 && <View style={[styles.bar, { width: `${share * 100}%`, backgroundColor: chart.series1 }]} />}
              </View>
            )}
            <AppText size="xs" tone="muted">
              {b.last_update ? `آخر تحديث من الفرع: ${formatTimeAgo(b.last_update, now)}` : "لا تحديثات من الفرع في هذه الفترة"}
              {note && cov === "partial" ? ` · ${note}` : ""}
            </AppText>
          </Pressable>
        );
      })}
      {branches.length === 0 && (
        <AppText size="sm" tone="muted">
          لا توجد فروع
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4, paddingVertical: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rank: { width: 18, textAlign: "center" },
  name: { flex: 1 },
  // شريط ≤ 24px يبدأ من خط أساس واحد (يمين الشاشة في RTL)، طرف البيانات مدوّر 4px
  track: { height: 10, borderRadius: 4, overflow: "hidden", flexDirection: "row" },
  bar: { height: "100%", borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
});
