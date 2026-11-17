/**
 * المخزون: نواقص كل فرع (تحت حد الطلب) مع اقتراح التحويل من فرع فيه فائض، والأصناف القريبة من الانتهاء.
 * الاقتراح ينشئ «طلب تحويل» باسم الفرع الناقص بنفس مسار البرنامج، والفرع الآخر يوافق أو يرفض.
 */
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type {
  BranchExpiring,
  BranchShortages,
  Shortage,
  Suggestion,
} from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Screen } from "@/components/shared/Screen";
import { ListSkeleton } from "@/components/shared/Skeletons";
import {
  useExpiring,
  useRequestTransfer,
  useShortages,
} from "@/features/reports/hooks/useReports";
import { expiryText } from "@/features/reports/lib/reportText";
import { formatQty } from "@/features/transfers/lib/transferText";
import { useNow } from "@/hooks/useNow";
import { useOnline } from "@/hooks/useOnline";
import { formatTimeAgo } from "@/lib/format";
import { radius, space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

type Tab = "shortages" | "expiring";

/** أول عدد يُعرض لكل فرع (الأجهزة الضعيفة): الباقي بزر، فلا تُرسم مئات الأسطر مرة واحدة. */
const FIRST = 40;

function MoreButton({
  total,
  shown,
  onPress,
}: {
  total: number;
  shown: number;
  onPress: () => void;
}) {
  if (shown >= total) return null;
  return (
    <Button
      title={`عرض الباقي (${total - shown})`}
      variant="ghost"
      onPress={onPress}
    />
  );
}

function Updated({ at }: { at: string | null }) {
  const now = useNow();
  return (
    <AppText size="xs" tone={at ? "muted" : "warning"}>
      {at
        ? `آخر تحديث من الفرع: ${formatTimeAgo(at, now)}`
        : "لم يرسل الفرع هذه البيانات بعد (غير متصل أو يحتاج نسخة أحدث من البرنامج)"}
    </AppText>
  );
}

export default function StockRoute() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>("shortages");
  const shortages = useShortages();
  const expiring = useExpiring();
  const q = tab === "shortages" ? shortages : expiring;

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <View style={[styles.segment, { borderColor: colors.border }]}>
        {(["shortages", "expiring"] as const).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t }}
            onPress={() => setTab(t)}
            style={[
              styles.segBtn,
              tab === t && { backgroundColor: colors.primary },
            ]}
          >
            <AppText
              weight="medium"
              size="sm"
              style={{
                color: tab === t ? colors.primaryForeground : colors.foreground,
              }}
            >
              {t === "shortages" ? "النواقص" : "قرب الانتهاء"}
            </AppText>
          </Pressable>
        ))}
      </View>
      {q.isPending && <ListSkeleton count={4} />}
      {q.isError && !q.data && (
        <EmptyState
          icon="alert-circle-outline"
          title="تعذّر التحميل"
          description={errorMessage(q.error)}
        />
      )}
      {tab === "shortages" &&
        shortages.data?.map((b) => <ShortageBranch key={b.branch_id} b={b} />)}
      {tab === "expiring" &&
        expiring.data?.map((b) => <ExpiringBranch key={b.branch_id} b={b} />)}
    </Screen>
  );
}

function ExpiringBranch({ b }: { b: BranchExpiring }) {
  const [shown, setShown] = useState(FIRST);
  return (
    <Card key={b.branch_id}>
      <AppText weight="semibold">{b.branch_name}</AppText>
      <Updated at={b.updated_at} />
      {b.updated_at && b.items.length === 0 && (
        <AppText size="sm" tone="muted">
          لا أصناف قريبة من الانتهاء
        </AppText>
      )}
      {b.items.slice(0, shown).map((it) => (
        <View key={`${it.key}-${it.batch_no}-${it.expiry}`} style={styles.line}>
          <AppText weight="medium">{it.name}</AppText>
          <AppText
            size="xs"
            tone={
              expiryText(it.expiry).startsWith("منتهي")
                ? "destructive"
                : "warning"
            }
          >
            {expiryText(it.expiry)} · {formatQty(it.qty)} {it.unit}
            {it.batch_no ? ` · دفعة ${it.batch_no}` : ""}
          </AppText>
        </View>
      ))}
      <MoreButton
        total={b.items.length}
        shown={shown}
        onPress={() => setShown(b.items.length)}
      />
    </Card>
  );
}

function ShortageBranch({ b }: { b: BranchShortages }) {
  const [shown, setShown] = useState(FIRST);
  return (
    <Card>
      <AppText weight="semibold">{b.branch_name}</AppText>
      <Updated at={b.updated_at} />
      {b.updated_at && b.items.length === 0 && (
        <AppText size="sm" tone="muted">
          لا نواقص تحت حد الطلب
        </AppText>
      )}
      {b.items.slice(0, shown).map((it) => (
        <ShortageLine key={it.key} b={b} it={it} />
      ))}
      <MoreButton
        total={b.items.length}
        shown={shown}
        onPress={() => setShown(b.items.length)}
      />
    </Card>
  );
}

function ShortageLine({ b, it }: { b: BranchShortages; it: Shortage }) {
  const { colors } = useTheme();
  const request = useRequestTransfer();
  const online = useOnline();

  const ask = (s: Suggestion) => {
    const qty =
      it.need > 0 ? Math.min(it.need, s.surplus) : Math.min(s.surplus, it.min);
    Alert.alert(
      "طلب تحويل",
      `طلب ${formatQty(qty)} ${it.unit} «${it.name}» لفرع ${b.branch_name} من فرع ${s.branch_name}؟ يصل الطلب لفرع ${s.branch_name} ليوافق أو يرفض.`,
      [
        { text: "رجوع", style: "cancel" },
        {
          text: "إرسال الطلب",
          onPress: () =>
            request.mutate(
              {
                to_branch_id: b.branch_id,
                from_branch_id: s.branch_id,
                lines: [{ key: it.key, qty }],
              },
              {
                onSuccess: (t) =>
                  router.push({
                    pathname: "/transfer/[id]",
                    params: { id: t.id },
                  }),
              },
            ),
        },
      ],
    );
  };

  return (
    <View style={styles.line}>
      <AppText weight="medium">{it.name}</AppText>
      <AppText size="xs" tone="muted">
        المتوفر {formatQty(it.qty)} من حد الطلب {formatQty(it.min)} {it.unit}
      </AppText>
      {it.suggestions.length > 0 ? (
        <View style={styles.chips}>
          {it.suggestions.map((s) => (
            <Pressable
              key={s.branch_id}
              accessibilityRole="button"
              disabled={!online || request.isPending}
              onPress={() => ask(s)}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.secondary,
                  opacity: pressed || !online ? 0.6 : 1,
                },
              ]}
            >
              <AppText size="xs" weight="medium">
                اطلب من {s.branch_name} (فائض {formatQty(s.surplus)})
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText size="xs" tone="muted">
          لا فائض معروف في فروع أخرى
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  segBtn: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  line: { gap: 2, paddingVertical: space.xs },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    marginTop: 2,
  },
  chip: { borderWidth: 1, paddingHorizontal: space.sm, paddingVertical: 4 },
});
