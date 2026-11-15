/** التنقّل السفلي: الرئيسية، الفروع، التحويلات، التنبيهات، المزيد (أول تبويب على اليمين في RTL). */
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";

import { fontFamily } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";

type IconName = ComponentProps<typeof Ionicons>["name"];

const TABS: { name: string; title: string; icon: IconName; active: IconName }[] = [
  { name: "index", title: "الرئيسية", icon: "home-outline", active: "home" },
  { name: "branches", title: "الفروع", icon: "storefront-outline", active: "storefront" },
  { name: "transfers", title: "التحويلات", icon: "swap-horizontal-outline", active: "swap-horizontal" },
  { name: "alerts", title: "التنبيهات", icon: "notifications-outline", active: "notifications" },
  { name: "more", title: "المزيد", icon: "menu-outline", active: "menu" },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 11 },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fontFamily.semibold },
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
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? tab.active : tab.icon} size={size} color={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
