/** رفض الطلب: سبب إجباري يصل للفرع الطالب، ثم تأكيد صريح. لا يحرّك مخزوناً. */
import { useState } from "react";
import { Alert } from "react-native";

import type { Transfer } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Sheet } from "@/components/shared/Sheet";
import { TextField } from "@/components/shared/TextField";

interface Props {
  t: Transfer;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectSheet({ t, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const ok = reason.trim().length >= 2;

  const confirm = () =>
    Alert.alert("تأكيد الرفض", `سيُرفض طلب ${t.to_branch_name} رقم #${t.number}، ويصلهم السبب.`, [
      { text: "رجوع", style: "cancel" },
      { text: "رفض الطلب", style: "destructive", onPress: () => onConfirm(reason.trim()) },
    ]);

  return (
    <Sheet title={`رفض طلب #${t.number}`} onClose={onClose}>
      <AppText size="sm" tone="muted">
        يظهر السبب للفرع الطالب ({t.to_branch_name}).
      </AppText>
      <TextField
        label="سبب الرفض"
        value={reason}
        onChangeText={setReason}
        maxLength={300}
        multiline
        autoFocus
        placeholder="مثال: الكمية غير متوفرة حالياً"
      />
      <Button title="رفض الطلب" icon="close-circle-outline" variant="destructive" onPress={confirm} disabled={!ok} />
      <Button title="إلغاء" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}
