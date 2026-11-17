/**
 * هياكل التحميل: نفس شكل المحتوى القادم تقريباً (بدل نص «جارٍ التحميل…»)، فلا تقفز الشاشة حين تصل البيانات.
 */
import { StyleSheet, View } from "react-native";

import { space } from "@/theme/colors";

import { Card } from "./Card";
import { Skeleton } from "./Motion";

/** بطاقات قائمة (فروع، تحويلات، تنبيهات). */
export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View
      style={styles.list}
      accessibilityLabel="جارٍ التحميل"
      accessibilityRole="progressbar"
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} style={styles.card}>
          <View style={styles.row}>
            <Skeleton width="45%" height={16} />
            <Skeleton width={56} height={16} />
          </View>
          <Skeleton width="80%" height={11} />
          <Skeleton width="55%" height={11} />
        </Card>
      ))}
    </View>
  );
}

/** لوحة الأرقام: الرقم الرئيسي + 6 بطاقات + بطاقة رسم. */
export function DashboardSkeleton() {
  return (
    <View
      style={styles.list}
      accessibilityLabel="جارٍ تحميل الأرقام"
      accessibilityRole="progressbar"
    >
      <Card style={styles.hero}>
        <Skeleton width={90} height={12} />
        <Skeleton width="65%" height={38} />
        <Skeleton width={120} height={12} />
      </Card>
      <View style={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} style={styles.tile}>
            <Skeleton width="50%" height={11} />
            <Skeleton width="75%" height={20} />
            <Skeleton width="35%" height={11} />
          </Card>
        ))}
      </View>
      <Card>
        <Skeleton width={110} height={14} />
        <Skeleton height={28} />
        <Skeleton width="70%" height={11} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  card: { gap: space.sm, paddingVertical: space.md },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hero: { gap: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { flexBasis: "48%", flexGrow: 1, gap: space.sm, padding: space.md },
});
