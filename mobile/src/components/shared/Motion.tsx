/**
 * مكوّنات الحركة المشتركة (Animated المدمج + native driver: لا مكتبات إضافية، وسلس على الأجهزة الضعيفة).
 *   FadeIn          ظهور بانزلاق خفيف لأعلى، متدرج حسب ترتيب العنصر.
 *   PressableScale  ضغط يُصغّر العنصر قليلاً ثم يرجع بارتداد خفيف (بدل الشفافية وحدها).
 *   Skeleton        مستطيل نابض مكان محتوى لم يصل بعد.
 *   useCountUp      عدّ رقم من قيمته السابقة للجديدة (الرقم الرئيسي فقط).
 * كلها تحترم «تقليل الحركة» في الهاتف.
 */
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import {
  Animated,
  Pressable,
  type DimensionValue,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import {
  duration,
  easeOut,
  spring,
  staggerDelay,
  useReducedMotion,
} from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";

/* ---------- FadeIn ---------- */

interface FadeInProps extends PropsWithChildren {
  /** ترتيب العنصر في المجموعة (يحدد التأخير). */
  index?: number;
  /** تأخير إضافي بالـ ms. */
  delay?: number;
  /** مسافة الانزلاق لأعلى. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeIn({
  index = 0,
  delay = 0,
  offset = 12,
  style,
  children,
}: FadeInProps) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: duration.slow,
      delay: delay + staggerDelay(index),
      easing: easeOut,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // الظهور مرة واحدة عند التركيب فقط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offset, 0],
  });
  return (
    <Animated.View
      style={[style, { opacity: progress, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

/* ---------- PressableScale ---------- */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, "style"> {
  /** حجم العنصر أثناء الضغط: 0.97 للأزرار، 0.985 للبطاقات الكبيرة. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
}

export function PressableScale({
  scaleTo = 0.97,
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const to = (value: number, config: typeof spring.press | typeof spring.pop) =>
    Animated.spring(scale, {
      toValue: value,
      ...config,
      useNativeDriver: true,
    }).start();

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!reduced) to(scaleTo, spring.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduced) to(1, spring.pop);
        onPressOut?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    />
  );
}

/* ---------- Skeleton ---------- */

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = "100%",
  height = 14,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 650,
          easing: easeOut,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, backgroundColor: colors.muted, opacity: pulse },
        style,
      ]}
    />
  );
}

/* ---------- useGrow ---------- */

/**
 * قيمة 0←1 تُعاد كلما تغيّر key (بيانات جديدة للرسم): الأعمدة تنمو من خط الأساس.
 * native = false للخصائص التي لا يحركها الـ native driver (العرض بالنسبة المئوية).
 */
export function useGrow(
  key: unknown,
  { native = true, delay = 0 }: { native?: boolean; delay?: number } = {},
) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: duration.count,
      delay,
      easing: easeOut,
      useNativeDriver: native,
    });
    anim.start();
    return () => anim.stop();
  }, [key, progress, reduced, native, delay]);

  return progress;
}

/** شفافية تنتقل بنعومة لقيمة جديدة (بيانات قديمة باهتة أثناء جلب الفترة الجديدة). */
export function useFadeTo(target: number) {
  const [value] = useState(() => new Animated.Value(target));
  useEffect(() => {
    Animated.timing(value, {
      toValue: target,
      duration: duration.base,
      useNativeDriver: true,
    }).start();
  }, [target, value]);
  return value;
}

/* ---------- useCountUp ---------- */

/** يعدّ من آخر قيمة معروضة للقيمة الجديدة (أول عرض: من الصفر). يرجع القيمة الحالية كعدد صحيح. */
export function useCountUp(
  target: number,
  ms: number = duration.count,
): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? target : 0);
  const shownRef = useRef(shown);

  useEffect(() => {
    if (reduced) {
      shownRef.current = target;
      return;
    }
    const from = shownRef.current;
    if (from === target) return;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min((Date.now() - start) / ms, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      shownRef.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms, reduced]);

  // تقليل الحركة: القيمة النهائية فوراً بلا عدّ
  return reduced ? target : shown;
}
