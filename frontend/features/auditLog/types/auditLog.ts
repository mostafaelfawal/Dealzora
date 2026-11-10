/** تغييرات العملية: {حقل: {from, to}} أو {حقل: قيمة}. */
export type AuditChanges = Record<string, unknown>;

export interface AuditEntry {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  actorName: string | null;
  changes: AuditChanges | null;
  createdAt: number;
}

export interface AuditActor {
  id: string;
  name: string;
}

/** "all" = بدون فلتر. */
export interface AuditFilters {
  entity: string;
  action: string;
  actor: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

export interface AuditEntryDto {
  id: string;
  entity: string;
  entity_id: string;
  action: string;
  actor_name: string | null;
  changes: AuditChanges | null;
  created_at: string;
}
