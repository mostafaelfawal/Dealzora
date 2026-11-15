/**
 * الموافقة من الهاتف: الكمية لكل صنف (افتراضياً المطلوبة، 0 = غير متوفر) وملاحظة، ثم تأكيد صريح.
 * الفرع المطلوب منه ينفّذها مع مزامنته (خصم المخزون من دفعاته وحساب التكلفة) كما لو وُفق عليها من البرنامج.
 */
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import type { Transfer } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Sheet } from "@/components/shared/Sheet";
import { TextField } from "@/components/shared/TextField";
import { space } from "@/theme/colors";

import type { ApproveLine } from "../api/transfers.api";
import { formatQty, lineQty, parseQty } from "../lib/transferText";

interface Props {
  t: Transfer;
  onClose: () => void;
  onConfirm: (lines: ApproveLine[], note: string) => void;
}

export function ApproveSheet({ t, onClose, onConfirm }: Props) {
  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(t.lines.map((l) => [l.id, formatQty(lineQty(l)).replace(/,/g, "")])),
  );
  const [note, setNote] = useState("");

  const parsed = t.lines.map((l) => ({ line: l, qty: parseQty(text[l.id] ?? "", lineQty(l)) }));
  const invalid = parsed.some((p) => p.qty === null);
  const sending = parsed.filter((p) => (p.qty ?? 0) > 0);

  function confirm() {
    const lines = parsed.map((p) => ({ line_id: p.line.id, qty: p.qty ?? 0 }));
    const missing = parsed.length - sending.length;
    Alert.alert(
      "تأكيد الموافقة",
      `سيُرسل فرع ${t.from_branch_name} ${sending.length} صنف إلى ${t.to_branch_name}` +
        (missing ? ` (و${missing} غير متوفر)` : "") +
        ". يخصمها الفرع من مخزونه مع مزامنته التالية.",
      [
        { text: "رجوع", style: "cancel" },
        { text: "موافقة", onPress: () => onConfirm(lines, note.trim()) },
      ],
    );
  }

  return (
    <Sheet title={`الموافقة على طلب #${t.number}`} onClose={onClose}>
      <AppText size="sm" tone="muted">
        عدّل الكمية لو المتوفر أقل، و0 = غير متوفر.
      </AppText>
      {t.lines.map((l) => {
        const bad = parseQty(text[l.id] ?? "", lineQty(l)) === null;
        return (
          <View key={l.id} style={styles.line}>
            <View style={styles.flex}>
              <AppText weight="medium" numberOfLines={2}>
                {l.name}
              </AppText>
              <AppText size="xs" tone="muted">
                المطلوب {formatQty(lineQty(l))} {l.unit}
              </AppText>
            </View>
            <View style={styles.qty}>
              <TextField
                label="الكمية"
                value={text[l.id] ?? ""}
                onChangeText={(v) => setText((s) => ({ ...s, [l.id]: v }))}
                keyboardType="decimal-pad"
                ltr
                error={bad ? "أكبر من المطلوب" : null}
                accessibilityLabel={`كمية ${l.name}`}
              />
            </View>
          </View>
        );
      })}
      <TextField label="ملاحظة للفرع (اختياري)" value={note} onChangeText={setNote} maxLength={300} />
      <Button
        title={sending.length ? `موافقة وإرسال ${sending.length} صنف` : "لا توجد كميات للإرسال"}
        icon="checkmark-circle-outline"
        onPress={confirm}
        disabled={invalid || sending.length === 0}
      />
      <Button title="إلغاء" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: space.md },
  flex: { flex: 1 },
  qty: { width: 110 },
});
