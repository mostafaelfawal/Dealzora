/** التنقّل السفلي: الرئيسية، الفروع، التحويلات، التنبيهات، المزيد (أول تبويب على اليمين في RTL). */
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import { useEffect, useState, type ComponentProps } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useUnreadCount } from "@/features/alerts/hooks/useAlerts";
import { fontFamily } from "@/theme/fonts";
import { duration, easeOut, spring, useReducedMotion } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";

type IconName = ComponentProps<typeof Ionicons>["name"];

const TABS: {
  name: string;
  title: string;
  icon: IconName;
  active: IconName;
}[] = [
  { name: "index", title: "الرئيسية", icon: "home-outline", active: "home" },
  {
    name: "branches",
    title: "الفروع",
    icon: "storefront-outline",
    active: "storefront",
  },
  {
    name: "transfers",
    title: "التحويلات",
    icon: "swap-horizontal-outline",
    active: "swap-horizontal",
  },
  {
    name: "alerts",
    title: "التنبيهات",
    icon: "notifications-outline",
    active: "notifications",
  },
  { name: "more", title: "المزيد", icon: "menu-outline", active: "menu" },
];

/** أيقونة التبويب: خلفية تتمدد من المنتصف للتبويب النشط، والأيقونة ترتد قليلاً عند اختيارها. */
function TabIcon({
  name,
  color,
  focused,
}: {
  name: IconName;
  color: string;
  focused: boolean;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [pill] = useState(() => new Animated.Value(focused ? 1 : 0));
  const [pop] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) {
      pill.setValue(focused ? 1 : 0);
      return;
    }
    Animated.timing(pill, {
      toValue: focused ? 1 : 0,
      duration: duration.base,
      easing: easeOut,
      useNativeDriver: true,
    }).start();
    if (focused) {
      pop.setValue(0.82);
      Animated.spring(pop, {
        toValue: 1,
        ...spring.pop,
        useNativeDriver: true,
      }).start();
    }
  }, [focused, pill, pop, reduced]);

  return (
    <View style={styles.iconWrap}>
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: colors.muted,
            opacity: pill,
            transform: [{ scaleX: pill }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Ionicons name={name} size={22} color={color} />
      </Animated.View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const unread = useUnreadCount();
  const reduced = useReducedMotion();
  return (
    <Tabs
      screenOptions={{
        animation: reduced ? "none" : "shift",
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        // بلا ارتفاع ثابت: الارتفاع الافتراضي يضيف مساحة شريط الإيماءات أسفل الشاشة
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 11 },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fontFamily.bold, fontSize: 18 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            // عدد التنبيهات غير المقروءة على تبويب التنبيهات
            tabBarBadge:
              tab.name === "alerts" && unread > 0
                ? unread > 99
                  ? "99+"
                  : unread
                : undefined,
            tabBarBadgeStyle: {
              fontFamily: fontFamily.semibold,
              fontSize: 10,
              backgroundColor: colors.destructive,
            },
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                name={focused ? tab.active : tab.icon}
                color={String(color)}
                focused={focused}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 52,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
});
