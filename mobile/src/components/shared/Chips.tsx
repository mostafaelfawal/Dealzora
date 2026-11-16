/**
 * اختيار واحد من عدة خيارات بأزرار مستطيلة حادة. تلتف لسطر جديد بدل التمرير الأفقي: كل الخيارات ظاهرة دائماً
 * على الشاشات الضيقة (التمرير الأفقي في RTL كان يخفي آخر خيار).
 */
import { StyleSheet, View } from "react-native";

import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { AppText } from "./AppText";
import { PressableScale } from "./Motion";

interface Props<T> {
  options: readonly T[];
  value: T | null;
  label: (v: T) => string;
  onChange: (v: T) => void;
  disabled?: boolean;
}

export function Chips<T extends string | number>({ options, value, label, onChange, disabled }: Props<T>) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const active = o === value;
        return (
          <PressableScale
            key={String(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: !!disabled }}
            disabled={disabled}
            scaleTo={0.94}
            onPress={() => onChange(o)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.secondary,
                borderColor: active ? colors.primary : colors.border,
                opacity: disabled ? 0.5 : 1,
              },
            ]}
          >
            <AppText
              label
              size="sm"
              weight={active ? "semibold" : "medium"}
              style={{ color: active ? colors.primaryForeground : colors.foreground }}
            >
              {label(o)}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { borderWidth: 1, paddingHorizontal: space.md, minHeight: 36, justifyContent: "center" },
});
