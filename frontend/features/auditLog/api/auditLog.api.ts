import { cleanParams, toMs } from "@/lib/apiMap";
import { api } from "@/lib/axios";

import type {
  AuditActor,
  AuditOption,
  AuditEntry,
  AuditEntryDto,
  AuditFilters,
} from "../types/auditLog";

const toAuditEntry = (r: AuditEntryDto): AuditEntry => ({
  id: r.id,
  entity: r.entity,
  entityLabel: r.entity_label,
  entityId: r.entity_id,
  action: r.action,
  actionLabel: r.action_label,
  actorName: r.actor_name,
  summary: r.summary,
  details: r.details,
  danger: r.danger,
  changes: r.changes,
  createdAt: toMs(r.created_at),
});

export async function fetchAuditLog(f: AuditFilters) {
  const { data } = await api.get<{ items: AuditEntryDto[]; total: number }>(
    "/audit-log",
    {
      params: cleanParams({
        entity: f.entity,
        action: f.action,
        actor_id: f.actor,
        date_from: f.from,
        date_to: f.to,
        page: f.page,
        page_size: f.pageSize,
      }),
    },
  );
  return { total: data.total, items: data.items.map(toAuditEntry) };
}

export const fetchAuditActors = async () =>
  (await api.get<AuditActor[]>("/audit-log/actors")).data;

/** الأنواع والعمليات الموجودة فعلاً في السجل بأسمائها العربية (من الـ backend). */
export const fetchAuditFilters = async () =>
  (
    await api.get<{ entities: AuditOption[]; actions: AuditOption[] }>(
      "/audit-log/filters",
    )
  ).data;
