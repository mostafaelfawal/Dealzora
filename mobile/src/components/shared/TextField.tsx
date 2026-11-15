import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from "react-native";

import { radius, space } from "@/theme/colors";
import { fontFamily, fontSize } from "@/theme/fonts";
import { rtlText } from "@/theme/rtl";
import { useTheme } from "@/theme/ThemeProvider";

import { AppText } from "./AppText";

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
  /** كلمة مرور بزر إظهار/إخفاء. */
  secret?: boolean;
  /** حقول لاتينية (العنوان، الكود، اسم المستخدم) تُكتب من اليسار. */
  ltr?: boolean;
}

export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, hint, error, secret, ltr, style, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      <AppText weight="medium" size="sm">
        {label}
      </AppText>
      <View
        style={[
          styles.box,
          {
            borderColor: error ? colors.destructive : focused ? colors.ring : colors.input,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TextInput
          {...rest}
          ref={ref}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={secret && hidden}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.input,
            ltr ? { writingDirection: "ltr", textAlign: "left" } : rtlText,
            { color: colors.foreground, fontFamily: fontFamily.regular },
            style,
          ]}
        />
        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? "إظهار كلمة المرور" : "إخفاء كلمة المرور"}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
      {error ? (
        <AppText size="xs" tone="destructive">
          {error}
        </AppText>
      ) : hint ? (
        <AppText size="xs" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  box: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.md, minHeight: 48 },
  input: { flex: 1, fontSize: fontSize.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  eye: { paddingHorizontal: space.md },
});
