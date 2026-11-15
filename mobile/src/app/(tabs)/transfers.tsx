/** التحويلات: ما ينتظر ردك أولاً، ثم الكل بالحالة والفرع والتاريخ. */
import { useState } from "react";
import { View } from "react-native";

import { errorMessage } from "@/api/errors";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Chips } from "@/components/shared/Chips";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { Screen } from "@/components/shared/Screen";
import type { TransferFilter } from "@/features/transfers/api/transfers.api";
import { TransferRow } from "@/features/transfers/components/TransferRow";
import { useTransfers } from "@/features/transfers/hooks/useTransfers";

const FILTERS: { id: TransferFilter; label: string }[] = [
  { id: "needs_action", label: "ينتظر ردك" },
  { id: "all", label: "الكل" },
  { id: "requested", label: "طلبات" },
  { id: "sent", label: "في الطريق" },
  { id: "received", label: "مُستلمة" },
];

export default function TransfersRoute() {
  const [filter, setFilter] = useState<TransferFilter>("needs_action");
  const q = useTransfers(filter);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen onRefresh={() => void q.refetch()} refreshing={q.isRefetching && !q.isFetchingNextPage}>
      <Chips
        options={FILTERS.map((f) => f.id)}
        value={filter}
        label={(id) => FILTERS.find((f) => f.id === id)?.label ?? ""}
        onChange={setFilter}
      />
      <LastUpdated at={q.dataUpdatedAt} />

      {items.map((t) => (
        <TransferRow key={t.id} t={t} />
      ))}

      {q.isPending && <AppText tone="muted">جارٍ التحميل…</AppText>}
      {q.isError && !q.data && (
        <EmptyState icon="alert-circle-outline" title="تعذّر تحميل التحويلات" description={errorMessage(q.error)} />
      )}
      {q.data && items.length === 0 && (
        <EmptyState
          icon={filter === "needs_action" ? "checkmark-done-outline" : "swap-horizontal-outline"}
          title={filter === "needs_action" ? "لا طلبات تنتظر ردك" : "لا توجد تحويلات"}
          description={filter === "needs_action" ? "طلبات التحويل من فروعك تظهر هنا للموافقة أو الرفض" : undefined}
        />
      )}
      {q.hasNextPage && (
        <View>
          <Button title="تحميل المزيد" variant="secondary" onPress={() => void q.fetchNextPage()} loading={q.isFetchingNextPage} />
        </View>
      )}
    </Screen>
  );
}
