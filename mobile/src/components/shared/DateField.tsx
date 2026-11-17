/** منتقي التاريخ الأصلي في الهاتف. نسخة الويب في DateField.web.tsx (Metro يختارها تلقائياً). */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Platform } from "react-native";

export interface DateFieldProps {
  value: Date;
  maximumDate?: Date;
  /** null = أُغلق بلا اختيار. */
  onPick: (date: Date | null) => void;
}

export function DateField({ value, maximumDate, onPick }: DateFieldProps) {
  return (
    <DateTimePicker
      value={value}
      mode="date"
      display={Platform.OS === "ios" ? "inline" : "default"}
      maximumDate={maximumDate}
      onChange={(e: DateTimePickerEvent, date?: Date) =>
        onPick(e.type === "set" && date ? date : null)
      }
      locale="ar-EG"
    />
  );
}
