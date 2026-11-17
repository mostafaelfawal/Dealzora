/** المزيد: حسابي، المظهر، القفل بالبصمة، الخادم، الإصدار. */
import Constants from "expo-constants";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";

import { AppSwitch } from "@/components/shared/AppSwitch";
import { AppText } from "@/components/shared/AppText";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { Card } from "@/components/shared/Card";
import { Chips } from "@/components/shared/Chips";
import { ListRow } from "@/components/shared/ListRow";
import { FadeIn } from "@/components/shared/Motion";
import { Screen } from "@/components/shared/Screen";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLockSettings } from "@/features/lock/hooks/useLockSettings";
import { toIsoDay } from "@/lib/period";
import { getServerUrl } from "@/lib/serverUrl";
import {
  THEME_LABEL,
  THEME_PREFS,
  setThemePref,
  useThemePref,
} from "@/theme/themePref";

export default function MoreRoute() {
  const { user } = useAuth();
  const lock = useLockSettings();
  const theme = useThemePref();
  const [server, setServer] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    void getServerUrl().then(setServer);
  }, []);

  async function onToggle(next: boolean) {
    setToggling(true);
    try {
      if (!(await lock.toggle(next)))
        Alert.alert(
          "لم يتم التغيير",
          `تأكيد ${lock.label} مطلوب لتغيير القفل.`,
        );
    } finally {
      setToggling(false);
    }
  }

  return (
    <Screen>
      <FadeIn index={0}>
        <Card>
          <ListRow
            icon="person-circle-outline"
            title="حسابي"
            subtitle={user?.username}
            onPress={() => router.push("/account")}
          />
          <ListRow
            icon="receipt-outline"
            title="الإيصالات الإلكترونية"
            subtitle="المنتظر والمقبول والمرفوض لكل فرع"
            onPress={() => router.push("/receipts")}
          />
          <ListRow
            icon="notifications-outline"
            title="إعدادات التنبيهات"
            onPress={() => router.push("/alerts-settings")}
          />
        </Card>
      </FadeIn>

      <FadeIn index={1}>
        <Card>
          <AppText size="xs" tone="muted" weight="semibold">
            تقارير الفروع
          </AppText>
          <ListRow
            icon="sparkles-outline"
            title="ملخص اليوم"
            subtitle="أرقام يومك بالشرائح مع تحليل سريع"
            onPress={() =>
              router.push({
                pathname: "/recap/[period]/[date]",
                params: { period: "day", date: toIsoDay(new Date()) },
              })
            }
          />
          <ListRow
            icon="calendar-outline"
            title="ملخص الأسبوع"
            subtitle="آخر 7 أيام: الأيام الأقوى والأصناف والفروع"
            onPress={() =>
              router.push({
                pathname: "/recap/[period]/[date]",
                params: { period: "week", date: toIsoDay(new Date()) },
              })
            }
          />
          <ListRow
            icon="cube-outline"
            title="المخزون والنواقص"
            subtitle="تحت حد الطلب، واقتراح التحويل، وقرب الانتهاء"
            onPress={() => router.push("/stock")}
          />
          <ListRow
            icon="time-outline"
            title="الورديات"
            subtitle="فروق النقدية لكل كاشير"
            onPress={() => router.push("/shifts")}
          />
          <ListRow
            icon="shield-outline"
            title="العمليات الحساسة"
            onPress={() => router.push("/sensitive")}
          />
          <ListRow
            icon="podium-outline"
            title="الأكثر مبيعاً"
            onPress={() => router.push("/top-sellers")}
          />
        </Card>
      </FadeIn>

      {/* أمان المحل: للمالك فقط (مدير الفرع لا يرى هذه الشاشات أصلاً، والخادم يرفضها له) */}
      {user?.role === "owner" && (
        <FadeIn index={2}>
          <Card>
            <AppText size="xs" tone="muted" weight="semibold">
              أمان المحل
            </AppText>
            <ListRow
              icon="people-outline"
              title="الموظفون"
              subtitle="إيقاف حساب موظف فوراً"
              onPress={() => router.push("/security/staff")}
            />
            <ListRow
              icon="desktop-outline"
              title="أجهزة الفروع"
              subtitle="إلغاء ربط جهاز مفقود، وكود ربط جديد"
              onPress={() => router.push("/security/devices")}
            />
            <ListRow
              icon="phone-portrait-outline"
              title="جلسات الهاتف"
              subtitle="هواتف كل المستخدمين المسجّلة"
              onPress={() => router.push("/security/sessions")}
            />
            <ListRow
              icon="pricetag-outline"
              title="أسعار الأصناف"
              subtitle="تعديل سعر البيع والجملة لكل الفروع"
              onPress={() => router.push("/prices")}
            />
            <ListRow
              icon="options-outline"
              title="حدود العمليات الحساسة"
              subtitle="الخصم والمرتجع وفرق النقدية وأيام الصلاحية"
              onPress={() => router.push("/report-settings")}
            />
          </Card>
        </FadeIn>
      )}

      <FadeIn index={3}>
        <Card>
          <ListRow
            icon="contrast-outline"
            title="المظهر"
            subtitle="تلقائي يتبع إعداد الهاتف"
          />
          <Chips
            options={THEME_PREFS}
            value={theme}
            label={(t) => THEME_LABEL[t]}
            onChange={setThemePref}
          />
        </Card>
      </FadeIn>

      <FadeIn index={4}>
        <Card>
          <ListRow
            icon="keypad-outline"
            title="القفل برمز سري"
            subtitle={
              lock.pinSet
                ? "مفعّل: يُطلب عند فتح التطبيق"
                : "على أي هاتف، وفي نسخة الويب على الآيفون"
            }
            trailing={
              <AppSwitch
                value={lock.pinSet}
                onValueChange={(on) =>
                  router.push({
                    pathname: "/pin",
                    params: { mode: on ? "set" : "remove" },
                  })
                }
                disabled={lock.loading}
                accessibilityLabel="القفل برمز سري"
              />
            }
          />
          {lock.pinSet && (
            <ListRow
              icon="create-outline"
              title="تغيير الرمز السري"
              onPress={() =>
                router.push({ pathname: "/pin", params: { mode: "change" } })
              }
            />
          )}
          <ListRow
            icon="finger-print-outline"
            title={`القفل بـ${lock.label}`}
            subtitle={
              lock.available
                ? "عند فتح التطبيق وبعد دقيقة في الخلفية"
                : Platform.OS === "web"
                  ? "غير متاح في نسخة الويب: استخدم الرمز السري"
                  : "سجّل بصمة أو وجهاً في إعدادات الهاتف لتفعيله"
            }
            trailing={
              <AppSwitch
                value={lock.enabled}
                onValueChange={onToggle}
                disabled={!lock.available || lock.loading || toggling}
                accessibilityLabel="القفل بالبصمة"
              />
            }
          />
        </Card>
      </FadeIn>

      <FadeIn index={5}>
        <Card>
          <ListRow
            icon="server-outline"
            title="خادم المزامنة"
            subtitle={server?.replace(/^https?:\/\//, "") ?? "—"}
          />
          <View style={styles.about}>
            <BrandLogo width={96} style={styles.logo} />
            <AppText size="xs" tone="muted">
              الإصدار {Constants.expoConfig?.version ?? "—"}
            </AppText>
          </View>
        </Card>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // الشعار بجانب رقم الإصدار أسفل الشاشة
  about: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  logo: { alignSelf: "auto" },
});
