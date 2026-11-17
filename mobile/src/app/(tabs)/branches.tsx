import { errorMessage } from "@/api/errors";
import { EmptyState } from "@/components/shared/EmptyState";
import { LastUpdated } from "@/components/shared/LastUpdated";
import { Screen } from "@/components/shared/Screen";
import { ListSkeleton } from "@/components/shared/Skeletons";
import { BranchList } from "@/features/branches/components/BranchList";
import { useBranches } from "@/features/branches/hooks/useBranches";

export default function BranchesRoute() {
  const branches = useBranches();
  return (
    <Screen
      onRefresh={() => void branches.refetch()}
      refreshing={branches.isRefetching}
    >
      <LastUpdated at={branches.dataUpdatedAt} />
      {branches.data && branches.data.length > 0 && (
        <BranchList branches={branches.data} />
      )}
      {branches.data?.length === 0 && (
        <EmptyState
          icon="storefront-outline"
          title="لا توجد فروع"
          description="لا توجد فروع مسندة لحسابك"
        />
      )}
      {!branches.data && branches.isPending && <ListSkeleton />}
      {!branches.data && branches.isError && (
        <EmptyState
          icon="alert-circle-outline"
          title="تعذّر تحميل الفروع"
          description={errorMessage(branches.error)}
        />
      )}
    </Screen>
  );
}
