/**
 * مفتاح تشغيل بنفس هوية البرنامج المكتبي (frontend/components/ui/switch.tsx): مستطيل بحواف حادة 32×18،
 * لون primary مفعّلاً و input متوقفاً، ومقبض مربع. يتحرك من اليسار لليمين دائماً (dir="ltr" كما في البرنامج).
 */
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

const WIDTH = 32;
const HEIGHT = 18;
const THUMB = 14;
const TRAVEL = WIDTH - THUMB - 4; // فراغ 2px من كل جهة داخل المستطيل

interface Props {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function AppSwitch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: Props) {
  const { colors, isDark } = useTheme();
  // قيمة متحركة واحدة لعمر المكوّن (useState: لا قراءة ref أثناء الرسم).
  const [x] = useState(() => new Animated.Value(value ? TRAVEL : 0));

  useEffect(() => {
    Animated.timing(x, {
      toValue: value ? TRAVEL : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [value, x]);

  // نفس ألوان البرنامج: المقبض لون الخلفية، وفي الداكن primary-foreground مفعّلاً و foreground متوقفاً.
  const thumb = isDark
    ? value
      ? colors.primaryForeground
      : colors.foreground
    : colors.background;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={10}
      onPress={() => onValueChange(!value)}
      style={[
        styles.track,
        {
          backgroundColor: value ? colors.primary : colors.input,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          { backgroundColor: thumb, transform: [{ translateX: x }] },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // direction ltr: المقبض يتحرك يميناً عند التفعيل حتى داخل واجهة RTL (كما في البرنامج).
  track: {
    width: WIDTH,
    height: HEIGHT,
    padding: 2,
    justifyContent: "center",
    direction: "ltr",
  },
  thumb: { width: THUMB, height: THUMB },
});
