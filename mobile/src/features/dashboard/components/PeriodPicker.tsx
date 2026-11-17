/**
 * اختيار الفترة: اليوم، أمس، آخر 7 أيام، هذا الشهر، مخصص (نفس تعريفات البرنامج المكتبي).
 * المخصص: تاريخ بداية ونهاية (حتى سنة) من منتقي التاريخ الأصلي للنظام.
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Chips } from "@/components/shared/Chips";
import {
  PERIOD_LABELS,
  clampCustom,
  formatRange,
  parseIsoDay,
  type DateRange,
  type PeriodPreset,
} from "@/lib/period";
import { radius, space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { setCustomRange, setPreset } from "../lib/periodStore";

const PRESETS: PeriodPreset[] = [
  "today",
  "yesterday",
  "week",
  "month",
  "custom",
];

interface Props {
  preset: PeriodPreset;
  range: DateRange;
}

export function PeriodPicker({ preset, range }: Props) {
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Chips
        options={PRESETS}
        value={preset}
        label={(p) => PERIOD_LABELS[p]}
        onChange={(p) => (p === "custom" ? setCustomOpen(true) : setPreset(p))}
      />
      <AppText size="xs" tone="muted">
        {formatRange(range)}
      </AppText>
      {customOpen && (
        <CustomRangeModal
          initial={range}
          onClose={() => setCustomOpen(false)}
          onApply={(r) => {
            setCustomRange(r);
            setCustomOpen(false);
          }}
        />
      )}
    </View>
  );
}

function CustomRangeModal({
  initial,
  onClose,
  onApply,
}: {
  initial: DateRange;
  onClose: () => void;
  onApply: (r: DateRange) => void;
}) {
  const { colors } = useTheme();
  const [from, setFrom] = useState(() => parseIsoDay(initial.from));
  const [to, setTo] = useState(() => parseIsoDay(initial.to));
  const [editing, setEditing] = useState<"from" | "to" | null>(null);
  const today = new Date();

  const onPick = (e: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setEditing(null); // نافذة أندرويد تُغلق بعد الاختيار
    if (e.type !== "set" || !date) return;
    if (editing === "from") setFrom(date);
    else setTo(date);
  };

  const range = clampCustom(from, to);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="إغلاق"
      >
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <AppText weight="bold" size="lg">
            فترة مخصصة
          </AppText>
          {(["from", "to"] as const).map((which) => (
            <Pressable
              key={which}
              accessibilityRole="button"
              onPress={() => setEditing(which)}
              style={[
                styles.field,
                { borderColor: editing === which ? colors.ring : colors.input },
              ]}
            >
              <AppText label size="sm" tone="muted">
                {which === "from" ? "من" : "إلى"}
              </AppText>
              <AppText label weight="medium">
                {formatRange({ from: range[which], to: range[which] })}
              </AppText>
            </Pressable>
          ))}
          {editing && (
            <DateTimePicker
              value={editing === "from" ? from : to}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              maximumDate={today}
              onChange={onPick}
              locale="ar-EG"
            />
          )}
          <AppText size="xs" tone="muted">
            حتى سنة كاملة
          </AppText>
          <View style={styles.actions}>
            <Button
              title="عرض"
              onPress={() => onApply(range)}
              style={styles.flex}
            />
            <Button
              title="إلغاء"
              variant="ghost"
              onPress={onClose}
              style={styles.flex}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: space.lg,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actions: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
});
