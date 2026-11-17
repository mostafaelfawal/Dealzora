/**
 * اتجاه صافي المبيعات يوماً بيوم (أعمدة لسلسلة واحدة، Views فقط: خفيف على الأجهزة الضعيفة).
 * - أكثر من 45 يوماً تُجمع أسبوعياً (لا أعمدة أرفع من أن تُلمس).
 * - المرتجعات الأكبر من المبيعات = عمود تحت خط الصفر.
 * - اللمس يعرض قيمة العمود (بديل التمرير بالماوس)، والقيمة الأعلى والأخيرة مكتوبتان دائماً.
 * - يوم لم ترسل فيه كل الفروع يُعلَّم بنقطة (الرقم ناقص لا صفر).
 */
import { useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

import type { SummaryDay } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Card } from "@/components/shared/Card";
import { useGrow } from "@/components/shared/Motion";
import { formatPiastres } from "@/lib/format";
import { formatShortDay, formatWeekday } from "@/lib/period";
import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

const HEIGHT = 120;
const WEEKLY_AFTER = 45;

interface Bucket {
  label: string;
  title: string;
  net: number;
  incomplete: boolean;
}

function buckets(days: SummaryDay[], branchCount: number): Bucket[] {
  const incomplete = (d: SummaryDay) => d.reported_branches < branchCount;
  if (days.length <= WEEKLY_AFTER) {
    return days.map((d) => ({
      label: days.length > 10 ? formatShortDay(d.day) : formatWeekday(d.day),
      title: formatShortDay(d.day),
      net: d.net,
      incomplete: incomplete(d),
    }));
  }
  const out: Bucket[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    const first = chunk[0]!;
    const last = chunk[chunk.length - 1]!;
    out.push({
      label: formatShortDay(first.day),
      title: `${formatShortDay(first.day)} – ${formatShortDay(last.day)}`,
      net: chunk.reduce((a, d) => a + d.net, 0),
      incomplete: chunk.some(incomplete),
    });
  }
  return out;
}

export function TrendBars({
  days,
  branchCount,
}: {
  days: SummaryDay[];
  branchCount: number;
}) {
  const { colors, chart } = useTheme();
  const data = useMemo(() => buckets(days, branchCount), [days, branchCount]);
  const [selected, setSelected] = useState<number | null>(null);
  // الأعمدة تنمو من خط الصفر (لأعلى للموجب ولأسفل للسالب) حين تتغير الأرقام
  const grow = useGrow(data.map((d) => d.net).join("|"), { delay: 250 });

  const maxV = Math.max(...data.map((d) => d.net), 0);
  const minV = Math.min(...data.map((d) => d.net), 0);
  const span = maxV - minV || 1;
  const zeroFromTop = (maxV / span) * HEIGHT;
  const peak = data.reduce(
    (best, d, i) => (d.net > (data[best]?.net ?? -Infinity) ? i : best),
    0,
  );
  const shown = selected ?? data.length - 1;
  const focus = data[shown];
  const weekly = days.length > WEEKLY_AFTER;

  return (
    <Card>
      <AppText weight="semibold">
        {weekly ? "صافي المبيعات أسبوعياً" : "صافي المبيعات يوماً بيوم"}
      </AppText>
      {focus && (
        <AppText size="sm" tone="muted">
          {focus.title}:{" "}
          <AppText size="sm" weight="semibold">
            {formatPiastres(focus.net)}
          </AppText>
          {focus.incomplete ? " · بعض الفروع لم ترسل" : ""}
          {selected === null && data.length > 1 && shown !== peak
            ? `  ·  الأعلى ${data[peak]!.title}`
            : ""}
        </AppText>
      )}
      <View style={[styles.plot, { height: HEIGHT }]}>
        <View
          style={[
            styles.zero,
            { top: zeroFromTop, backgroundColor: colors.border },
          ]}
        />
        {data.map((d, i) => {
          const h = Math.max(
            (Math.abs(d.net) / span) * HEIGHT,
            d.net === 0 ? 0 : 2,
          );
          const active = i === shown;
          return (
            <Pressable
              key={`${d.title}-${i}`}
              style={styles.slot}
              onPress={() => setSelected(i === selected ? null : i)}
              accessibilityRole="button"
              accessibilityLabel={`${d.title}: ${formatPiastres(d.net)}${d.incomplete ? "، بيانات ناقصة" : ""}`}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              <Animated.View
                style={[
                  styles.bar,
                  {
                    height: h,
                    top: d.net >= 0 ? zeroFromTop - h : zeroFromTop,
                    backgroundColor:
                      d.net < 0 ? colors.destructive : chart.series1,
                    opacity: selected === null || active ? 1 : 0.4,
                    transformOrigin: d.net >= 0 ? "bottom" : "top",
                    transform: [{ scaleY: grow }],
                  },
                ]}
              />
              {d.incomplete && (
                <View
                  style={[styles.dot, { backgroundColor: colors.warning }]}
                />
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        <AppText size="xs" tone="muted">
          {data[0]?.label}
        </AppText>
        <AppText size="xs" tone="muted">
          {data[data.length - 1]?.label}
        </AppText>
      </View>
      {data.some((d) => d.incomplete) && (
        <View style={styles.key}>
          <View
            style={[
              styles.dot,
              styles.keyDot,
              { backgroundColor: colors.warning },
            ]}
          />
          <AppText size="xs" tone="muted">
            يوم لم ترسل فيه كل الفروع (الرقم ناقص)
          </AppText>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: "row", alignItems: "stretch", marginTop: space.sm },
  zero: { position: "absolute", left: 0, right: 0, height: 1 },
  // فاصل 2px بين الأعمدة المتجاورة، وعرض العمود ≤ 24px
  slot: { flex: 1, marginHorizontal: 1, alignItems: "center" },
  bar: { position: "absolute", width: "100%", maxWidth: 24 },
  dot: {
    position: "absolute",
    bottom: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.md,
  },
  key: { flexDirection: "row", alignItems: "center", gap: space.sm },
  keyDot: { position: "relative", bottom: 0 },
});
