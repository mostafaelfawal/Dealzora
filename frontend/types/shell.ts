export type { Shift } from "@/features/shifts/types/shift";

export type SyncStatusType = "synced" | "syncing" | "offline" | "error";

export interface SyncState {
  status: SyncStatusType;
  /** وقت آخر نسخة احتياطية ناجحة (timestamp بالمللي ثانية، 0 = لا يوجد). */
  lastSyncedAt: number;
}

export interface Subscription {
  daysRemaining: number;
}
