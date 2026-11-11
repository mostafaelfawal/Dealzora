/** تغييرات العملية: {حقل: {from, to}} أو {حقل: قيمة}. */
export type AuditChanges = Record<string, unknown>;

/** سطر تفاصيل جاهز من الـ backend: «الحقل: قبل ← بعد» أو «الحقل: قيمة». */
export interface AuditDetail {
  label: string;
  /** null = قيمة واحدة (إضافة/حذف) وليس تغييراً. */
  before: string | null;
  after: string;
}

export interface AuditEntry {
  id: string;
  entity: string;
  entityLabel: string;
  entityId: string;
  action: string;
  actionLabel: string;
  actorName: string | null;
  /** جملة عربية مقروءة، مثل: عدّل الصنف «سكر». */
  summary: string;
  details: AuditDetail[];
  /** حذف، مرتجع، تعديل مخزون، دخول فاشل... */
  danger: boolean;
  /** الخام كما خُزّن (للدعم الفني). */
  changes: AuditChanges | null;
  createdAt: number;
}

export interface AuditOption {
  value: string;
  label: string;
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
  entity_label: string;
  entity_id: string;
  action: string;
  action_label: string;
  actor_name: string | null;
  summary: string;
  details: AuditDetail[];
  danger: boolean;
  changes: AuditChanges | null;
  created_at: string;
}
