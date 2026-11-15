import { EmptyState } from "@/components/shared/EmptyState";
import { Screen } from "@/components/shared/Screen";

export default function TransfersRoute() {
  return (
    <Screen>
      <EmptyState
        icon="swap-horizontal-outline"
        title="التحويلات قريباً"
        description="متابعة تحويلات المخزون وطلباتها بين فروعك في التحديث القادم"
      />
    </Screen>
  );
}
