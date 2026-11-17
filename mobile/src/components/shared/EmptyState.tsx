import { Ionicons } from "@expo/vector-icons";
import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Animated, StyleSheet, View } from "react-native";

import { space } from "@/theme/colors";
import { spring, useReducedMotion } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";

import { AppText } from "./AppText";
import { FadeIn } from "./Motion";

interface Props {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  description?: string;
  action?: ReactNode;
}

/** حالة فارغة/خطأ: الأيقونة تظهر بارتداد خفيف ثم النص. */
export function EmptyState({ icon, title, description, action }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [pop] = useState(() => new Animated.Value(reduced ? 1 : 0.6));

  useEffect(() => {
    if (reduced) return;
    Animated.spring(pop, {
      toValue: 1,
      ...spring.pop,
      useNativeDriver: true,
    }).start();
  }, [pop, reduced]);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.icon,
          {
            backgroundColor: colors.muted,
            borderColor: colors.border,
            transform: [{ scale: pop }],
          },
        ]}
      >
        <Ionicons name={icon} size={30} color={colors.mutedForeground} />
      </Animated.View>
      <FadeIn delay={80} style={styles.text}>
        <AppText weight="semibold" size="lg" center>
          {title}
        </AppText>
        {description && (
          <AppText tone="muted" size="sm" center style={styles.desc}>
            {description}
          </AppText>
        )}
        {action}
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xl * 2,
    paddingHorizontal: space.lg,
  },
  icon: {
    width: 72,
    height: 72,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { alignItems: "center", gap: space.xs },
  desc: { maxWidth: 300 },
});
