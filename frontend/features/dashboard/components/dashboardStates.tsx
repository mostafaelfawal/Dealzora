"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const KPI_COUNT = 8;

export function DashboardSkeleton() {
  return (
    <div aria-busy className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: KPI_COUNT }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed py-16">
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <Button variant="outline" onClick={onRetry}>
        إعادة المحاولة
      </Button>
    </div>
  );
}
