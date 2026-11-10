import { cleanParams, toMs } from "@/lib/apiMap";
import { api } from "@/lib/axios";

import type {
  AuditActor,
  AuditEntry,
  AuditEntryDto,
  AuditFilters,
} from "../types/auditLog";

const toAuditEntry = (r: AuditEntryDto): AuditEntry => ({
  id: r.id,
  entity: r.entity,
  entityId: r.entity_id,
  action: r.action,
  actorName: r.actor_name,
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
