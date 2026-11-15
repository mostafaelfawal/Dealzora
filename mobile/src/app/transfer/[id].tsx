/**
 * تفاصيل تحويل: الحالة، الفرعان، المواعيد، الأصناف، وموافقة الهاتف إن وجدت.
 * الموافقة/الرفض لمن يملكها فقط (المالك، أو مدير الفرع المطلوب منه) بنفس قواعد البرنامج، وبتأكيد صريح.
 */
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type { Transfer, TransferLine } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { Money } from "@/components/shared/Money";
import { Screen } from "@/components/shared/Screen";
import { ApproveSheet } from "@/features/transfers/components/ApproveSheet";
import { RejectSheet } from "@/features/transfers/components/RejectSheet";
import { TransferStatusBadge } from "@/features/transfers/components/TransferStatusBadge";
import { useTransfer, useTransferActions } from "@/features/transfers/hooks/useTransfers";
import { approvalBusy, approvalText, formatQty, lineQty, transferSummary } from "@/features/transfers/lib/transferText";
import { useOnline } from "@/hooks/useOnline";
import { formatDateTime } from "@/lib/format";
import { radius, space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

export default function TransferRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useTransfer(id);
  const actions = useTransferActions(id);
  const online = useOnline();
  const [sheet, setSheet] = useState<"approve" | "reject" | null>(null);
  const t = q.data;

  return (
    <>
      <Stack.Screen options={{ title: t ? `تحويل #${t.number}` : "التحويل" }} />
      <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
        {!t && q.isPending && <AppText tone="muted">جارٍ التحميل…</AppText>}
        {!t && q.isError && (
          <EmptyState icon="alert-circle-outline" title="تعذّر فتح التحويل" description={errorMessage(q.error)} />
        )}
        {t && (
          <>
            <Header t={t} />
            <LastUpdated at={q.dataUpdatedAt} />
            <ApprovalCard t={t} onCancel={() => confirmCancel(() => actions.cancel.mutate())} cancelling={actions.cancel.isPending} />
            <Lines t={t} />
            {(t.can_approve || t.can_reject) && (
              <View style={styles.actions}>
                {t.can_approve && (
                  <Button
                    title="موافقة وإرسال"
                    icon="checkmark-circle-outline"
                    onPress={() => setSheet("approve")}
                    loading={actions.approve.isPending}
                    disabled={!online || actions.reject.isPending}
                  />
                )}
                {t.can_reject && (
                  <Button
                    title="رفض الطلب"
                    icon="close-circle-outline"
                    variant="destructive"
                    onPress={() => setSheet("reject")}
                    loading={actions.reject.isPending}
                    disabled={!online || actions.approve.isPending}
                  />
                )}
                {!online && (
                  <AppText size="xs" tone="muted" center>
                    الموافقة والرفض يحتاجان اتصالاً بالإنترنت
                  </AppText>
                )}
              </View>
            )}
            {sheet === "approve" && (
              <ApproveSheet
                t={t}
                onClose={() => setSheet(null)}
                onConfirm={(lines, note) => {
                  setSheet(null);
                  actions.approve.mutate({ t, lines, note });
                }}
              />
            )}
            {sheet === "reject" && (
              <RejectSheet
                t={t}
                onClose={() => setSheet(null)}
                onConfirm={(reason) => {
                  setSheet(null);
                  actions.reject.mutate({ t, reason });
                }}
              />
            )}
          </>
        )}
      </Screen>
    </>
  );
}

function confirmCancel(onYes: () => void) {
  Alert.alert("إلغاء الموافقة", "لن ينفّذ الفرع هذه الموافقة، ويرجع الطلب في انتظار الرد.", [
    { text: "رجوع", style: "cancel" },
    { text: "إلغاء الموافقة", style: "destructive", onPress: onYes },
  ]);
}

function Header({ t }: { t: Transfer }) {
  const rows: [string, string | null][] = [
    ["طلبه", t.requested_by && t.requested_at ? `${t.requested_by} · ${formatDateTime(t.requested_at)}` : null],
    ["أرسله", t.sent_at ? `${t.sent_by ?? "—"} · ${formatDateTime(t.sent_at)}` : null],
    ["استلمه", t.received_at ? `${t.received_by ?? "—"} · ${formatDateTime(t.received_at)}` : null],
    ["رُفض", t.rejected_at ? formatDateTime(t.rejected_at) : null],
    ["سبب الرفض", t.reject_reason],
    ["ملاحظة", t.note],
    ["ملاحظة الاستلام", t.receive_note],
  ];
  return (
    <Card>
      <View style={styles.row}>
        <AppText weight="bold" size="lg" style={styles.flex}>
          {transferSummary(t)}
        </AppText>
        <TransferStatusBadge status={t.status} />
      </View>
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <View key={k} style={styles.row}>
            <AppText size="sm" tone="muted" style={styles.key}>
              {k}
            </AppText>
            <AppText size="sm" style={styles.flex}>
              {v}
            </AppText>
          </View>
        ))}
    </Card>
  );
}

function ApprovalCard({ t, onCancel, cancelling }: { t: Transfer; onCancel: () => void; cancelling: boolean }) {
  const { colors } = useTheme();
  const text = approvalText(t.approval, t.status);
  if (!text || !t.approval) return null;
  const failed = ["failed", "superseded", "expired"].includes(t.approval.status);
  const busy = approvalBusy(t.approval);
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.notice,
        {
          backgroundColor: failed ? colors.destructiveSoft : busy ? colors.warningSoft : colors.muted,
          borderColor: failed ? colors.destructive : busy ? colors.warning : colors.border,
        },
      ]}
    >
      <Ionicons
        name={failed ? "alert-circle-outline" : busy ? "time-outline" : "phone-portrait-outline"}
        size={18}
        color={failed ? colors.destructive : busy ? colors.warning : colors.mutedForeground}
      />
      <View style={styles.flex}>
        <AppText size="sm" weight="medium">
          {text}
        </AppText>
        <AppText size="xs" tone="muted">
          {t.approval.device_name} · {formatDateTime(t.approval.created_at)}
        </AppText>
        {busy && (
          <AppText size="xs" tone="muted">
            يخصم الفرع الكميات من مخزونه مع مزامنته التالية (عادة خلال دقيقة والبرنامج مفتوح).
          </AppText>
        )}
      </View>
      {t.approval.status === "pending" && (
        <Button title="إلغاء" variant="ghost" onPress={onCancel} loading={cancelling} style={styles.smallBtn} />
      )}
    </View>
  );
}

function qtyText(l: TransferLine, t: Transfer): string {
  const parts = [`المطلوب ${formatQty(lineQty(l))}`];
  if (t.status !== "requested" && t.status !== "rejected" && t.status !== "withdrawn") parts.push(`المرسل ${formatQty(l.qty_sent)}`);
  if (l.qty_received !== null) parts.push(`المستلم ${formatQty(l.qty_received)}`);
  return `${parts.join(" · ")} ${l.unit}`;
}

function Lines({ t }: { t: Transfer }) {
  const shipped = !["requested", "rejected", "withdrawn"].includes(t.status);
  return (
    <Card>
      <AppText weight="semibold">الأصناف ({t.lines.length})</AppText>
      {t.lines.map((l) => (
        <View key={l.id} style={styles.line}>
          <AppText weight="medium">{l.name}</AppText>
          <AppText size="xs" tone="muted">
            {qtyText(l, t)}
            {l.batch_no ? ` · دفعة ${l.batch_no}` : ""}
            {l.expiry_date ? ` · صلاحية ${l.expiry_date}` : ""}
          </AppText>
          {l.qty_received !== null && l.qty_received < l.qty_sent && (
            <AppText size="xs" tone="destructive">
              عجز {formatQty(l.qty_sent - l.qty_received)} {l.unit}
            </AppText>
          )}
        </View>
      ))}
      {shipped && (
        <View style={styles.row}>
          <AppText size="sm" tone="muted" style={styles.flex}>
            تكلفة المرسل
          </AppText>
          <Money amount={t.total_cost} size="sm" weight="semibold" />
        </View>
      )}
      {t.shortage_cost > 0 && (
        <View style={styles.row}>
          <AppText size="sm" tone="muted" style={styles.flex}>
            تكلفة العجز
          </AppText>
          <Money amount={t.shortage_cost} size="sm" weight="semibold" tone="destructive" />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  key: { width: 96 },
  notice: { flexDirection: "row", gap: space.sm, borderWidth: 1, borderRadius: radius.md, padding: space.md },
  line: { gap: 2, paddingVertical: space.xs },
  actions: { gap: space.sm },
  smallBtn: { minHeight: 36, paddingHorizontal: space.sm },
});
