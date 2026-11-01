import type { SessionUser } from "@/types/auth";
import type { Shift, Subscription, SyncState } from "@/types/shell";

export const shellMock: {
  user: SessionUser;
  shift: Shift | null;
  drawerBalance: number;
  sync: SyncState;
  subscription: Subscription;
} = {
  user: { name: "أحمد محمود", role: "manager" },
  shift: { cashierName: "أحمد", openedAt: "2026-11-01T09:30:00" },
  drawerBalance: 3250,
  sync: { status: "synced", lastSyncedAt: Date.now() - 3 * 60_000 },
  subscription: { daysRemaining: 5 },
};
