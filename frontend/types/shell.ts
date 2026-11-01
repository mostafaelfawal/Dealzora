export interface Shift {
  cashierName: string;
  /** وقت فتح الوردية بصيغة ISO. */
  openedAt: string;
}

export type SyncStatusType = "synced" | "syncing" | "offline" | "error";

export interface SyncState {
  status: SyncStatusType;
  /** وقت آخر نسخة احتياطية ناجحة (timestamp بالمللي ثانية). */
  lastSyncedAt: number;
}

export interface Subscription {
  daysRemaining: number;
}
