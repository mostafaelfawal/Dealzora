/**
 * اختيار واحد من عدة خيارات بأزرار مستطيلة حادة. تلتف لسطر جديد بدل التمرير الأفقي: كل الخيارات ظاهرة دائماً
 * على الشاشات الضيقة (التمرير الأفقي في RTL كان يخفي آخر خيار).
 */
import { Pressable, StyleSheet, View } from "react-native";

import { space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { AppText } from "./AppText";

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
          <Pressable
            key={String(o)}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(o)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.secondary,
                borderColor: active ? colors.primary : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <AppText size="sm" weight="medium" style={{ color: active ? colors.primaryForeground : colors.foreground }}>
              {label(o)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { borderWidth: 1, paddingHorizontal: space.md, minHeight: 36, justifyContent: "center" },
});
