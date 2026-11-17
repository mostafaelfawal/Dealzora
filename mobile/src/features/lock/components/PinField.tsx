/**
 * حقل الرمز السري: أرقام فقط (ويقبل الأرقام العربية من لوحة المفاتيح)، مخفي، كبير في المنتصف،
 * مع خانات تُملأ أثناء الكتابة. «تم» في لوحة المفاتيح = إرسال.
 */
import { useRef, type ComponentRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { normalizeDigits } from "@/lib/format";
import { space } from "@/theme/colors";
import { fontFamily } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";

import { PIN_MAX, PIN_MIN } from "../lib/pin";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  error?: string | null;
  autoFocus?: boolean;
  disabled?: boolean;
  label?: string;
}

export function PinField({
  value,
  onChange,
  onSubmit,
  error,
  autoFocus,
  disabled,
  label = "الرمز السري",
}: Props) {
  const { colors } = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const slots = Math.max(PIN_MIN, Math.min(value.length + 1, PIN_MAX));

  return (
    <View style={styles.wrap}>
      <AppText size="sm" tone="muted" center>
        {label}
      </AppText>
      {/* الخانات: الضغط عليها يفتح لوحة الأرقام */}
      <Pressable
        accessibilityRole="none"
        onPress={() => input.current?.focus()}
        style={styles.slots}
      >
        {Array.from({ length: slots }, (_, i) => (
          <View
            key={i}
            style={[
              styles.slot,
              {
                borderColor: error
                  ? colors.destructive
                  : i === value.length
                    ? colors.foreground
                    : colors.border,
                backgroundColor: colors.card,
              },
            ]}
          >
            {i < value.length && (
              <View
                style={[styles.dot, { backgroundColor: colors.foreground }]}
              />
            )}
          </View>
        ))}
      </Pressable>
      {/* الحقل الفعلي فوق الخانات وشفاف: يعمل مع قارئ الشاشة ولوحة المفاتيح والويب */}
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) =>
          onChange(normalizeDigits(t).replace(/\D/g, "").slice(0, PIN_MAX))
        }
        onSubmitEditing={onSubmit}
        keyboardType="number-pad"
        inputMode="numeric"
        secureTextEntry
        autoFocus={autoFocus}
        editable={!disabled}
        maxLength={PIN_MAX}
        accessibilityLabel={label}
        textContentType="oneTimeCode"
        autoComplete="off"
        returnKeyType="done"
        caretHidden
        style={[styles.hidden, { fontFamily: fontFamily.regular }]}
      />
      {!!error && (
        <AppText
          size="sm"
          tone="destructive"
          center
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, alignSelf: "stretch" },
  // الخانات من اليسار لليمين مثل أي رمز أرقام
  slots: {
    flexDirection: "row",
    direction: "ltr",
    justifyContent: "center",
    gap: space.sm,
  },
  slot: {
    width: 40,
    height: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  hidden: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: 48,
    top: 28,
  },
});
