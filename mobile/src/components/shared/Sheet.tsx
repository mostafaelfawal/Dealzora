/** نافذة سفلية بسيطة (Modal) ترتفع مع لوحة المفاتيح، للإجراءات التي تحتاج إدخالاً قبل التأكيد. */
import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { AppText } from "./AppText";

interface Props extends PropsWithChildren {
  title: string;
  onClose: () => void;
}

export function Sheet({ title, onClose, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="إغلاق" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + space.lg },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <AppText weight="bold" size="lg">
            {title}
          </AppText>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.md,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2 },
  body: { gap: space.md, paddingBottom: space.sm },
});
