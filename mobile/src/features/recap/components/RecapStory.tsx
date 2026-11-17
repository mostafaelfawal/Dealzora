/**
 * عارض الملخص بشرائح (قصة): شريط تقدّم لكل شريحة أعلى الشاشة، تقدّم تلقائي، وأزرار التالي/السابق.
 *
 * - النقر على نصف الشاشة الأيسر = التالي، والأيمن = السابق (اتجاه القراءة العربي).
 * - الضغط المطوّل يوقف العرض مؤقتاً، ورفع الإصبع يكمله.
 * - «تقليل الحركة» في الهاتف: لا تقدّم تلقائي ولا انزلاق (التالي/السابق يدوياً فقط).
 * - الشريحة الأولى (الشعار واسم المتجر) تظهر فوراً والأرقام تُحمَّل خلفها.
 */
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "@/components/shared/AppText";
import { PressableScale } from "@/components/shared/Motion";
import { easeOut, useReducedMotion } from "@/theme/motion";

import type { Slide } from "../lib/recap";
import { ACCENT, Aura, SlideView, slideAccent, story } from "./RecapSlides";

/** مدة كل شريحة (ms): التحليل أطول لأنه نص يُقرأ. */
function slideMs(s: Slide): number {
  if (s.kind === "intro") return 3600;
  if (s.kind === "insights") return 6000 + s.items.length * 1800;
  if (s.kind === "top" || s.kind === "branches") return 7000;
  return 6000;
}

/** أقصر من هذا = نقرة (تنقّل)، وأطول = إيقاف مؤقت فقط. */
const TAP_MS = 220;

interface Props {
  slides: Slide[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}

export function RecapStory({
  slides,
  loading,
  error,
  onRetry,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [progress] = useState(() => new Animated.Value(0));
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const pausedAt = useRef(0);
  const pressStart = useRef(0);
  // انتهت المقدمة قبل وصول الأرقام: ننتقل فور وصولها.
  const pendingNext = useRef(false);

  const last = index >= slides.length - 1;
  const slide = slides[Math.min(index, slides.length - 1)]!;

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= slides.length) return;
      setDir(to > index ? 1 : -1);
      setIndex(to);
    },
    [index, slides.length],
  );

  const next = useCallback(() => {
    if (!last) go(index + 1);
    else if (!loading) onClose();
  }, [go, index, last, loading, onClose]);

  // نهاية الشريحة تقرأ أحدث حالة (البيانات قد تصل أثناء المقدمة).
  const onDone = useRef(() => {});
  useEffect(() => {
    onDone.current = () => {
      if (index < slides.length - 1) go(index + 1);
      else if (loading) pendingNext.current = true; // الختام لا يُغلق تلقائياً
    };
  });

  const run = useCallback(
    (from: number) => {
      anim.current?.stop();
      if (reduced) {
        progress.setValue(1);
        return;
      }
      progress.setValue(from);
      anim.current = Animated.timing(progress, {
        toValue: 1,
        duration: slideMs(slide) * (1 - from),
        easing: Easing.linear,
        useNativeDriver: false,
      });
      anim.current.start(({ finished }) => {
        if (finished) onDone.current();
      });
    },
    [progress, reduced, slide],
  );

  // كل شريحة جديدة: تقدّم من الصفر.
  useEffect(() => {
    pausedAt.current = 0;
    run(0);
    return () => anim.current?.stop();
    // run يتغير مع loading، ولا نريد إعادة الشريحة من البداية عند وصول البيانات
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    if (!loading && pendingNext.current) {
      pendingNext.current = false;
      go(1);
    }
  }, [loading, go]);

  const pause = () => {
    pressStart.current = Date.now();
    anim.current?.stop();
    progress.stopAnimation((v) => {
      pausedAt.current = v;
    });
  };

  const release = (e: GestureResponderEvent) => {
    const tap = Date.now() - pressStart.current < TAP_MS;
    if (tap) {
      // يسار الشاشة = التالي في العربي
      if (e.nativeEvent.pageX < width / 2) {
        if (!last) return go(index + 1);
      } else if (index > 0) return go(index - 1);
    }
    run(pausedAt.current);
  };

  /* دخول الشريحة: ظهور + انزلاق من جهة الحركة (التالي يأتي من اليسار في العربي). */
  const [enter] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) return;
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 360,
      easing: easeOut,
      useNativeDriver: true,
    }).start();
  }, [index, enter, reduced]);
  const translateX = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [dir === 1 ? -36 : 36, 0],
  });

  const accent = ACCENT[slideAccent(slide)];

  return (
    <View style={[styles.root, { backgroundColor: story.bg }]}>
      <StatusBar style="light" />
      <Aura key={`aura-${index}`} color={accent} />

      {/* شرائط التقدّم + الإغلاق */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View
          style={styles.bars}
          accessibilityRole="progressbar"
          accessibilityLabel={`الشريحة ${index + 1} من ${slides.length}`}
        >
          {slides.map((s, i) => (
            <View
              key={i}
              style={[styles.bar, { backgroundColor: story.track }]}
            >
              <Animated.View
                style={[
                  styles.barFill,
                  {
                    width:
                      i < index
                        ? "100%"
                        : i > index
                          ? "0%"
                          : progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["0%", "100%"],
                            }),
                  },
                ]}
              />
            </View>
          ))}
          {loading && <View style={[styles.bar, styles.barGhost]} />}
        </View>
        <View style={styles.topRow}>
          <AppText size="xs" weight="semibold" style={{ color: story.muted }}>
            Dealzora · ملخصك
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إغلاق الملخص"
            hitSlop={12}
            onPress={onClose}
            style={styles.close}
          >
            <Ionicons name="close" size={26} color={story.fg} />
          </Pressable>
        </View>
      </View>

      {/* المحتوى: النقر يقلّب، والضغط المطوّل يوقف */}
      <Pressable
        style={styles.flex}
        onPressIn={pause}
        onPressOut={release}
        accessible={false}
      >
        <Animated.View
          key={index}
          accessibilityLiveRegion="polite"
          style={[
            styles.content,
            { opacity: enter, transform: [{ translateX }] },
          ]}
        >
          <SlideView
            slide={slide}
            loading={loading}
            error={error}
            onRetry={onRetry}
            onReplay={() => go(0)}
            onClose={onClose}
          />
        </Animated.View>
      </Pressable>

      {/* السابق (يمين) / التالي (يسار) */}
      <View style={[styles.nav, { paddingBottom: insets.bottom + 12 }]}>
        <NavButton
          label="السابق"
          icon="chevron-forward"
          iconFirst
          disabled={index === 0}
          onPress={() => go(index - 1)}
        />
        <AppText size="xs" style={{ color: story.muted }}>
          {index + 1} / {loading ? "…" : slides.length}
        </AppText>
        <NavButton
          label={last && !loading ? "إنهاء" : "التالي"}
          icon={last && !loading ? "checkmark" : "chevron-back"}
          primary
          disabled={last && loading}
          onPress={next}
        />
      </View>
    </View>
  );
}

function NavButton({
  label,
  icon,
  iconFirst,
  primary,
  disabled,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  iconFirst?: boolean;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const fg = primary ? "#0a0a0a" : story.fg;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.94}
      style={[
        styles.navBtn,
        primary
          ? { backgroundColor: story.fg, borderColor: story.fg }
          : { borderColor: story.border },
        disabled && { opacity: 0.35 },
      ]}
    >
      {iconFirst && <Ionicons name={icon} size={18} color={fg} />}
      <AppText label weight="semibold" style={{ color: fg }}>
        {label}
      </AppText>
      {!iconFirst && <Ionicons name={icon} size={18} color={fg} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  flex: { flex: 1 },
  top: { paddingHorizontal: 12, gap: 10 },
  bars: { flexDirection: "row", gap: 4 },
  bar: { flex: 1, height: 3, overflow: "hidden" },
  barGhost: { backgroundColor: "rgba(255,255,255,0.08)" },
  barFill: { height: "100%", backgroundColor: story.fg },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  close: { padding: 4 },
  content: { flex: 1, paddingHorizontal: 20, paddingVertical: 12 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  navBtn: {
    minHeight: 46,
    minWidth: 112,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
});
