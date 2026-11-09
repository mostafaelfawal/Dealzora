export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

export const lastLoginLabel = (iso: string | null) =>
  iso ? formatDateTime(iso) : "لم يسجّل دخولاً بعد";
