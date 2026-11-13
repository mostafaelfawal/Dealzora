import type { TransferStatus } from "../api/branchTransfers.api";

export const STATUS_INFO: Record<
  TransferStatus,
  { label: string; className: string }
> = {
  requested: {
    label: "طلب في الانتظار",
    className: "bg-primary/10 text-primary",
  },
  rejected: { label: "مرفوض", className: "bg-destructive/10 text-destructive" },
  withdrawn: { label: "مسحوب", className: "bg-muted text-muted-foreground" },
  sent: { label: "في الطريق", className: "bg-warning/15 text-warning" },
  received: { label: "اتستلم", className: "bg-success/10 text-success" },
  partial: {
    label: "اتستلم بعجز",
    className: "bg-destructive/10 text-destructive",
  },
  cancelled: { label: "ملغي", className: "bg-muted text-muted-foreground" },
};
