import { EmptyState } from "@/components/shared/EmptyState";
import { Screen } from "@/components/shared/Screen";

export default function AlertsRoute() {
  return (
    <Screen>
      <EmptyState
        icon="notifications-outline"
        title="التنبيهات قريباً"
        description="فرع انقطع عن الخادم، تحويل ينتظر الموافقة، ونواقص المخزون، في التحديث القادم"
      />
    </Screen>
  );
}
