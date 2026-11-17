/**
 * شرائح الملخص: كل شريحة تُركَّب من جديد عند ظهورها، فتعيد حركتها كاملة:
 *   الأيقونة تقفز (spring) ← العنوان يظهر بانزلاق ← الرقم يُعدّ ← التفاصيل بالتتابع.
 * الخلفية «هالة» مربعة بلون الشريحة تدور ببطء (حواف حادة مثل هوية البرنامج).
 * كل الحركة بالـ native driver ما أمكن، وتتوقف مع «تقليل الحركة» في الهاتف.
 */
import { Ionicons } from "@expo/vector-icons";
import {
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { Button } from "@/components/shared/Button";
import { FadeIn, useCountUp, useGrow } from "@/components/shared/Motion";
import { CURRENCY } from "@/components/shared/Money";
import { formatPiastres } from "@/lib/format";
import { easeOut, spring, useReducedMotion } from "@/theme/motion";

import type { Accent, ChangePill, Insight, Slide, Tone } from "../lib/recap";

type IconName = ComponentProps<typeof Ionicons>["name"];

/* ---------- ألوان القصة (داكنة دائماً مثل ملخصات التطبيقات الكبيرة) ---------- */
export const story = {
  bg: "#0a0a0a",
  card: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.12)",
  fg: "#fafafa",
  muted: "#a3a3a3",
  track: "rgba(255,255,255,0.22)",
} as const;

export const ACCENT: Record<Accent, string> = {
  blue: "#3987e5",
  orange: "#eb6834",
  green: "#05df72",
  red: "#ff6467",
  amber: "#ffb020",
  violet: "#a78bfa",
};

const TONE: Record<Tone, string> = {
  good: ACCENT.green,
  warn: ACCENT.amber,
  info: ACCENT.blue,
};

export function slideAccent(s: Slide): Accent {
  switch (s.kind) {
    case "stat":
      return s.accent;
    case "intro":
      return "blue";
    case "branches":
      return "orange";
    case "days":
      return "blue";
    case "top":
      return "amber";
    case "payments":
      return "green";
    case "insights":
      return "violet";
    case "empty":
      return "amber";
    case "outro":
      return "green";
  }
}

/* ---------- أدوات الحركة ---------- */

/** قيمة 0←1 مرة واحدة عند التركيب (spring أو timing). */
function useEnter(delay: number, kind: "spring" | "timing" = "timing") {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) return;
    const anim =
      kind === "spring"
        ? Animated.spring(v, {
            toValue: 1,
            ...spring.pop,
            delay,
            useNativeDriver: true,
          })
        : Animated.timing(v, {
            toValue: 1,
            duration: 420,
            delay,
            easing: easeOut,
            useNativeDriver: true,
          });
    anim.start();
    return () => anim.stop();
    // مرة واحدة عند التركيب
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}

/** حلقة لا نهائية 0←1 (للزخارف). */
function useLoop(ms: number, delay = 0) {
  const reduced = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: ms,
        delay,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [v, ms, delay, reduced]);
  return v;
}

/** أيقونة داخل مربع بلون الشريحة: تقفز وتعتدل من ميل خفيف. */
function PopIcon({
  name,
  color,
  size = 34,
  delay = 80,
}: {
  name: IconName;
  color: string;
  size?: number;
  delay?: number;
}) {
  const v = useEnter(delay, "spring");
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const rotate = v.interpolate({
    inputRange: [0, 1],
    outputRange: ["-18deg", "0deg"],
  });
  return (
    <Animated.View
      style={[
        styles.iconTile,
        {
          borderColor: color,
          backgroundColor: `${color}1f`,
          opacity: v,
          transform: [{ scale }, { rotate }],
        },
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

/** الهالة الخلفية: مربع ضخم بلون الشريحة يدور ويتنفس ببطء. */
export function Aura({ color }: { color: string }) {
  const spin = useLoop(24_000);
  const enter = useEnter(0);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["45deg", "405deg"],
  });
  const scale = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.aura,
          {
            backgroundColor: color,
            opacity: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.13],
            }),
            transform: [{ rotate }, { scale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.aura2,
          {
            borderColor: color,
            opacity: enter.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.25],
            }),
            transform: [{ rotate }],
          },
        ]}
      />
    </View>
  );
}

/** مربعات تتسع وتتلاشى خلف الشعار (نبض). */
function PulseSquare({ delay, color }: { delay: number; color: string }) {
  const v = useLoop(2400, delay);
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulse,
        {
          borderColor: color,
          opacity: v.interpolate({
            inputRange: [0, 0.15, 1],
            outputRange: [0, 0.55, 0],
          }),
          transform: [
            { rotate: "45deg" },
            {
              scale: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 2.4],
              }),
            },
          ],
        },
      ]}
    />
  );
}

function T({
  children,
  size = 16,
  weight = "regular",
  color = story.fg,
  center,
  lines,
}: {
  children: ReactNode;
  size?: number;
  weight?: "regular" | "medium" | "semibold" | "bold";
  color?: string;
  center?: boolean;
  lines?: number;
}) {
  return (
    <AppText
      weight={weight}
      center={center}
      numberOfLines={lines}
      adjustsFontSizeToFit={!!lines}
      minimumFontScale={0.6}
      style={{ color, fontSize: size, lineHeight: Math.round(size * 1.45) }}
    >
      {children}
    </AppText>
  );
}

function Pill({ change }: { change: ChangePill }) {
  const color =
    change.tone === "up"
      ? ACCENT.green
      : change.tone === "down"
        ? ACCENT.red
        : story.muted;
  return (
    <View
      style={[
        styles.pill,
        { borderColor: color, backgroundColor: `${color}1a` },
      ]}
    >
      <T size={15} weight="bold" color={color}>
        {change.text}
      </T>
    </View>
  );
}

/* ---------- الشرائح ---------- */

export function SlideView({
  slide,
  loading,
  error,
  onRetry,
  onReplay,
  onClose,
}: {
  slide: Slide;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onReplay?: () => void;
  onClose?: () => void;
}) {
  switch (slide.kind) {
    case "intro":
      return (
        <Intro
          slide={slide}
          loading={loading}
          error={error}
          onRetry={onRetry}
        />
      );
    case "stat":
      return <Stat slide={slide} />;
    case "branches":
      return <Branches slide={slide} />;
    case "days":
      return <Days slide={slide} />;
    case "top":
      return <Top slide={slide} />;
    case "payments":
      return <Payments slide={slide} />;
    case "insights":
      return <Insights items={slide.items} />;
    case "empty":
      return <Empty slide={slide} />;
    case "outro":
      return <Outro slide={slide} onReplay={onReplay} onClose={onClose} />;
  }
}

function Intro({
  slide,
  loading,
  error,
  onRetry,
}: {
  slide: Extract<Slide, { kind: "intro" }>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const logo = useEnter(100, "spring");
  const color = ACCENT.blue;
  return (
    <View style={styles.center}>
      <View style={styles.logoWrap}>
        <PulseSquare delay={0} color={color} />
        <PulseSquare delay={800} color={color} />
        <PulseSquare delay={1600} color={color} />
        <Animated.View
          style={{
            opacity: logo,
            transform: [
              {
                scale: logo.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.55, 1],
                }),
              },
            ],
          }}
        >
          <BrandLogo width={190} tone="dark" />
        </Animated.View>
      </View>
      <FadeIn delay={450} offset={18}>
        <T size={15} color={story.muted} center>
          {slide.period === "day"
            ? "ملخص يومك في متاجرك على Dealzora"
            : "ملخص أسبوعك في متاجرك على Dealzora"}
        </T>
      </FadeIn>
      <FadeIn delay={700} offset={22}>
        <T size={32} weight="bold" center lines={2}>
          {slide.shop}
        </T>
      </FadeIn>
      <FadeIn delay={950} offset={14}>
        <View style={[styles.chip, { borderColor: story.border }]}>
          <Ionicons name="calendar-outline" size={15} color={story.muted} />
          <T size={14} color={story.fg}>
            {slide.periodLabel}
          </T>
        </View>
      </FadeIn>
      {error ? (
        <FadeIn delay={200}>
          <View style={styles.gapSm}>
            <T size={14} color={ACCENT.red} center>
              {error}
            </T>
            {onRetry && (
              <Button
                title="إعادة المحاولة"
                variant="secondary"
                icon="refresh-outline"
                onPress={onRetry}
              />
            )}
          </View>
        </FadeIn>
      ) : loading ? (
        <FadeIn delay={1300}>
          <T size={13} color={story.muted} center>
            نجهّز أرقامك…
          </T>
        </FadeIn>
      ) : null}
    </View>
  );
}

function Stat({ slide }: { slide: Extract<Slide, { kind: "stat" }> }) {
  const color = ACCENT[slide.accent];
  const shown = useCountUp(slide.value, 1100);
  return (
    <View style={styles.center}>
      <PopIcon name={slide.icon as IconName} color={color} />
      <FadeIn delay={180} offset={14}>
        <T size={18} weight="medium" color={story.muted} center>
          {slide.eyebrow}
        </T>
      </FadeIn>
      <FadeIn delay={280} offset={24}>
        <View style={styles.valueRow}>
          <T size={52} weight="bold" lines={1} center>
            {slide.format === "money"
              ? formatPiastres(shown)
              : shown.toLocaleString("en-US")}
          </T>
          {slide.format === "money" && (
            <T size={18} weight="medium" color={story.muted}>
              {CURRENCY}
            </T>
          )}
        </View>
      </FadeIn>
      {(slide.change || slide.caption) && (
        <FadeIn delay={560} offset={10}>
          <View style={styles.changeRow}>
            {slide.change && <Pill change={slide.change} />}
            {slide.caption && (
              <T size={14} color={story.muted}>
                {slide.caption}
              </T>
            )}
          </View>
        </FadeIn>
      )}
      {slide.extra.length > 0 && (
        <View style={styles.extraList}>
          {slide.extra.map((e, i) => (
            <FadeIn key={e.label} delay={760 + i * 110} offset={10}>
              <View style={[styles.extraRow, { borderColor: story.border }]}>
                <T size={14} color={story.muted}>
                  {e.label}
                </T>
                <T size={15} weight="semibold">
                  {e.value}
                </T>
              </View>
            </FadeIn>
          ))}
        </View>
      )}
    </View>
  );
}

function Header({
  icon,
  color,
  title,
  caption,
}: {
  icon: IconName;
  color: string;
  title: string;
  caption?: string;
}) {
  return (
    <View style={styles.header}>
      <PopIcon name={icon} color={color} size={28} />
      <FadeIn delay={180} offset={14}>
        <T size={26} weight="bold" center>
          {title}
        </T>
      </FadeIn>
      {!!caption && (
        <FadeIn delay={300} offset={10}>
          <T size={14} color={story.muted} center>
            {caption}
          </T>
        </FadeIn>
      )}
    </View>
  );
}

function GrowBar({
  share,
  color,
  delay,
}: {
  share: number;
  color: string;
  delay: number;
}) {
  const p = useGrow("bar", { native: false, delay });
  const width = p.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", `${Math.max(share * 100, 2)}%`],
  });
  return (
    <View style={[styles.track, { backgroundColor: story.track }]}>
      <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  );
}

function Branches({ slide }: { slide: Extract<Slide, { kind: "branches" }> }) {
  const color = ACCENT.orange;
  return (
    <View style={styles.block}>
      <Header
        icon="storefront-outline"
        color={color}
        title="ترتيب الفروع"
        caption={slide.caption}
      />
      {slide.rows.map((r, i) => (
        <FadeIn key={r.name} delay={420 + i * 120} offset={12}>
          <View style={styles.gapXs}>
            <View style={styles.between}>
              <T size={15} weight={i === 0 ? "bold" : "medium"}>
                {r.name}
              </T>
              <T size={14} color={story.muted}>
                {formatPiastres(r.net)} {CURRENCY}
              </T>
            </View>
            <GrowBar
              share={r.share}
              color={i === 0 ? color : `${color}99`}
              delay={520 + i * 120}
            />
          </View>
        </FadeIn>
      ))}
    </View>
  );
}

function DayBar({
  value,
  max,
  best,
  label,
  index,
}: {
  value: number;
  max: number;
  best: boolean;
  label: string;
  index: number;
}) {
  const p = useGrow("day", { native: false, delay: 380 + index * 90 });
  const h = max > 0 ? Math.max((value / max) * 170, value > 0 ? 6 : 2) : 2;
  const height = p.interpolate({ inputRange: [0, 1], outputRange: [0, h] });
  return (
    <View style={styles.dayCol}>
      <View style={styles.dayBarArea}>
        <Animated.View
          style={{
            height,
            backgroundColor: best ? ACCENT.blue : story.track,
            width: "100%",
          }}
        />
      </View>
      <T
        size={12}
        weight={best ? "bold" : "regular"}
        color={best ? story.fg : story.muted}
        center
      >
        {label}
      </T>
    </View>
  );
}

function Days({ slide }: { slide: Extract<Slide, { kind: "days" }> }) {
  const max = Math.max(...slide.bars.map((b) => b.value), 0);
  return (
    <View style={styles.block}>
      <Header
        icon="bar-chart-outline"
        color={ACCENT.blue}
        title="أيام أسبوعك"
        caption={slide.caption}
      />
      <View style={styles.daysRow}>
        {slide.bars.map((b, i) => (
          <DayBar key={`${b.label}-${i}`} {...b} max={max} index={i} />
        ))}
      </View>
    </View>
  );
}

function Top({ slide }: { slide: Extract<Slide, { kind: "top" }> }) {
  const color = ACCENT.amber;
  return (
    <View style={styles.block}>
      <Header icon="trophy-outline" color={color} title={slide.caption} />
      {slide.items.map((x, i) => (
        <FadeIn key={x.name} delay={420 + i * 140} offset={16}>
          <View
            style={[
              styles.card,
              { borderColor: i === 0 ? color : story.border },
            ]}
          >
            <View
              style={[
                styles.rank,
                { backgroundColor: i === 0 ? color : story.track },
              ]}
            >
              <T size={16} weight="bold" color={i === 0 ? "#0a0a0a" : story.fg}>
                {i + 1}
              </T>
            </View>
            <View style={styles.flex}>
              <T size={16} weight="semibold" lines={1}>
                {x.name}
              </T>
              <T size={13} color={story.muted}>
                {x.qty}
              </T>
            </View>
            <T size={14} weight="medium">
              {formatPiastres(x.revenue)}
            </T>
          </View>
        </FadeIn>
      ))}
    </View>
  );
}

const PAY_COLOR = {
  cash: ACCENT.green,
  wallet: ACCENT.blue,
  credit: ACCENT.orange,
} as const;

function PayPart({
  share,
  color,
  delay,
}: {
  share: number;
  color: string;
  delay: number;
}) {
  const p = useGrow("pay", { native: false, delay });
  const width = p.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", `${share * 100}%`],
  });
  return (
    <Animated.View style={{ width, backgroundColor: color, height: "100%" }} />
  );
}

function Payments({ slide }: { slide: Extract<Slide, { kind: "payments" }> }) {
  return (
    <View style={styles.block}>
      <Header icon="card-outline" color={ACCENT.green} title="كيف دفع عملاؤك" />
      <FadeIn delay={380}>
        <View style={[styles.stack, { backgroundColor: story.track }]}>
          {slide.parts.map((p, i) => (
            <PayPart
              key={p.key}
              share={p.share}
              color={PAY_COLOR[p.key]}
              delay={480 + i * 180}
            />
          ))}
        </View>
      </FadeIn>
      {slide.parts.map((p, i) => (
        <FadeIn key={p.key} delay={620 + i * 130} offset={10}>
          <View style={[styles.extraRow, { borderColor: story.border }]}>
            <View style={styles.legend}>
              <View
                style={[styles.swatch, { backgroundColor: PAY_COLOR[p.key] }]}
              />
              <T size={15}>{p.label}</T>
            </View>
            <T size={15} weight="semibold">
              {Math.round(p.share * 100)}% · {formatPiastres(p.value)}
            </T>
          </View>
        </FadeIn>
      ))}
    </View>
  );
}

const INSIGHT_LABEL: Record<Tone, string> = {
  good: "خبر جيد",
  warn: "انتبه",
  info: "ملاحظة",
};

function Insights({ items }: { items: Insight[] }) {
  return (
    <View style={styles.block}>
      <Header
        icon="bulb-outline"
        color={ACCENT.violet}
        title="تحليل سريع"
        caption="ملاحظات تلقائية من أرقامك"
      />
      {items.map((it, i) => {
        const c = TONE[it.tone];
        return (
          <FadeIn key={it.title} delay={420 + i * 160} offset={18}>
            <View
              style={[
                styles.insight,
                { borderColor: story.border, borderStartColor: c },
              ]}
            >
              <View style={[styles.insightIcon, { backgroundColor: `${c}22` }]}>
                <Ionicons name={it.icon as IconName} size={20} color={c} />
              </View>
              <View style={styles.flex}>
                <T size={11} weight="semibold" color={c}>
                  {INSIGHT_LABEL[it.tone]}
                </T>
                <T size={15} weight="semibold">
                  {it.title}
                </T>
                <T size={13} color={story.muted}>
                  {it.body}
                </T>
              </View>
            </View>
          </FadeIn>
        );
      })}
    </View>
  );
}

function Empty({ slide }: { slide: Extract<Slide, { kind: "empty" }> }) {
  return (
    <View style={styles.center}>
      <PopIcon name="moon-outline" color={ACCENT.amber} />
      <FadeIn delay={200} offset={16}>
        <T size={24} weight="bold" center>
          لا مبيعات مسجّلة
        </T>
      </FadeIn>
      <FadeIn delay={340} offset={10}>
        <T size={15} color={story.muted} center>
          {slide.missing > 0
            ? "بعض الفروع لم ترسل بياناتها بعد: الأرقام تظهر بعد اتصالها ومزامنتها."
            : `لم تُسجَّل فواتير في ${slide.periodLabel}.`}
        </T>
      </FadeIn>
    </View>
  );
}

function Outro({
  slide,
  onReplay,
  onClose,
}: {
  slide: Extract<Slide, { kind: "outro" }>;
  onReplay?: () => void;
  onClose?: () => void;
}) {
  return (
    <View style={styles.center}>
      <PopIcon name="checkmark-done-outline" color={ACCENT.green} size={40} />
      <FadeIn delay={220} offset={18}>
        <T size={30} weight="bold" center>
          {slide.title}
        </T>
      </FadeIn>
      <FadeIn delay={380} offset={12}>
        <T size={15} color={story.muted} center>
          {slide.body}
        </T>
      </FadeIn>
      <FadeIn delay={560} offset={12}>
        <View style={styles.gapSm}>
          {onClose && (
            <Button title="تم" icon="checkmark-outline" onPress={onClose} />
          )}
          {onReplay && (
            <Button
              title="شاهد من جديد"
              variant="secondary"
              icon="refresh-outline"
              onPress={onReplay}
            />
          )}
        </View>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    gap: 14,
    paddingHorizontal: 8,
  },
  block: { flex: 1, justifyContent: "center", gap: 14 },
  header: { alignItems: "center", gap: 8, marginBottom: 6 },
  iconTile: {
    width: 76,
    height: 76,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  aura: {
    position: "absolute",
    width: 520,
    height: 520,
    top: -180,
    left: -160,
  },
  aura2: {
    position: "absolute",
    width: 380,
    height: 380,
    bottom: -120,
    right: -140,
    borderWidth: 1,
  },
  logoWrap: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  pulse: { position: "absolute", width: 120, height: 120, borderWidth: 1.5 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  pill: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 2 },
  extraList: { gap: 8, marginTop: 8 },
  extraRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 12,
  },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  track: { height: 10, width: "100%", overflow: "hidden" },
  fill: { height: "100%" },
  daysRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 210,
    marginTop: 8,
  },
  dayCol: { flex: 1, gap: 6 },
  dayBarArea: { height: 172, justifyContent: "flex-end" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    padding: 12,
    backgroundColor: story.card,
  },
  rank: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: {
    flexDirection: "row",
    height: 22,
    overflow: "hidden",
    width: "100%",
  },
  legend: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 12, height: 12 },
  insight: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderStartWidth: 3,
    padding: 12,
    backgroundColor: story.card,
  },
  insightIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  gapXs: { gap: 6 },
  gapSm: { gap: 10, marginTop: 10 },
});
