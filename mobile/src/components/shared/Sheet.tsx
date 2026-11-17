/**
 * نافذة سفلية (Modal) ترتفع مع لوحة المفاتيح، للإجراءات التي تحتاج إدخالاً قبل التأكيد.
 * الخلفية تظهر تدريجياً والنافذة تصعد بنابض، والإغلاق (لمس الخلفية / زر الرجوع) يعكس الحركة ثم يُبلغ الأب.
 */
import { useEffect, useState, type PropsWithChildren } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, space } from "@/theme/colors";
import { duration, easeOut, spring, useReducedMotion } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";

import { AppText } from "./AppText";

interface Props extends PropsWithChildren {
  title: string;
  onClose: () => void;
}

const OFFSCREEN = Dimensions.get("window").height;

export function Sheet({ title, onClose, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [backdrop] = useState(() => new Animated.Value(0));
  const [y] = useState(() => new Animated.Value(reduced ? 0 : OFFSCREEN));
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: duration.base,
        useNativeDriver: true,
      }),
      reduced
        ? Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true })
        : Animated.spring(y, {
            toValue: 0,
            ...spring.sheet,
            useNativeDriver: true,
          }),
    ]).start();
  }, [backdrop, y, reduced]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: duration.base,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: reduced ? 0 : OFFSCREEN,
        duration: duration.base,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  return (
    <Modal
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          { opacity: backdrop },
        ]}
      />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable
          style={styles.flex}
          onPress={close}
          accessibilityLabel="إغلاق"
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: insets.bottom + space.lg,
              transform: [{ translateY: y }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.ring }]} />
          <AppText weight="bold" size="lg">
            {title}
          </AppText>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.md,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginBottom: space.xs,
    opacity: 0.6,
  },
  body: { gap: space.md, paddingBottom: space.sm },
});
