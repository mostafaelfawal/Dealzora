import { fromQty, toPounds, toQty } from "@/lib/apiMap";
import { api } from "@/lib/axios";

/* ---------- الأنواع ---------- */

export type TransferStatus =
  | "requested"
  | "rejected"
  | "withdrawn"
  | "sent"
  | "received"
  | "partial"
  | "cancelled";

export interface BranchStatus {
  connected: boolean;
  serverUrl?: string;
  branchName?: string;
  branchCode?: string;
  shopName?: string;
  pairedAt?: string;
  /** تحويلات اتخصمت من المخزون ولسه ما وصلتش للسيرفر (انقطاع نت). */
  pending: number;
  reachable?: boolean;
  /** الفرع الرئيسي (جهاز المالك): يدير فروع المحل وأكواد ربطها. */
  isAdmin?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  online: boolean;
  isMe: boolean;
}

export interface LineMatch {
  productId: string;
  name: string;
  unit: string;
  stock: number;
  allowDecimal: boolean;
}

export interface TransferLine {
  id: string;
  productId: string;
  barcode: string | null;
  name: string;
  unit: string;
  qtyRequested: number | null;
  qtySent: number;
  qtyReceived: number | null;
  unitCost: number;
  batchNo: string | null;
  expiryDate: string | null;
  /** الصنف المقابل في فرعي (null = لازم أختاره). */
  match: LineMatch | null;
}

export interface Transfer {
  id: string;
  number: number;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  status: TransferStatus;
  /** دوري فيه: sender = الفرع المرسل/المطلوب منه، receiver = المستلم/الطالب. */
  role: "sender" | "receiver";
  note: string | null;
  receiveNote: string | null;
  rejectReason: string | null;
  sentBy: string | null;
  receivedBy: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  totalCost: number;
  shortageCost: number;
  lines: TransferLine[];
  local: {
    pending: boolean;
    lastError: string | null;
    stockOutApplied: boolean;
    stockInApplied: boolean;
  } | null;
  /** إرسال اتخصم محلياً ولسه ما وصلش (انقطاع). */
  queued?: boolean;
  message?: string;
}

export interface PendingLocal {
  id: string;
  toBranchName: string;
  op: "create" | "approve";
  lastError: string | null;
  lines: number;
}

export interface TransfersSummary {
  connected: boolean;
  online: boolean;
  unpaired?: boolean;
  incoming: number;
  requests: number;
  pending: number;
}

/* ---------- التحويل من شكل الـ backend ---------- */

/* eslint-disable @typescript-eslint/no-explicit-any -- شكل الرد مكتوب في الـ backend */
const toTransfer = (d: any): Transfer => ({
  id: d.id,
  number: d.number ?? 0,
  fromBranchId: d.from_branch_id,
  fromBranchName: d.from_branch_name ?? "",
  toBranchId: d.to_branch_id,
  toBranchName: d.to_branch_name ?? "",
  status: d.status,
  role: d.role,
  note: d.note ?? null,
  receiveNote: d.receive_note ?? null,
  rejectReason: d.reject_reason ?? null,
  sentBy: d.sent_by ?? null,
  receivedBy: d.received_by ?? null,
  requestedBy: d.requested_by ?? null,
  requestedAt: d.requested_at ?? null,
  sentAt: d.sent_at ?? null,
  receivedAt: d.received_at ?? null,
  totalCost: toPounds(d.total_cost ?? 0),
  shortageCost: toPounds(d.shortage_cost ?? 0),
  lines: (d.lines ?? []).map((l: any) => ({
    id: l.id,
    productId: l.product_id,
    barcode: l.barcode ?? null,
    name: l.name,
    unit: l.unit,
    qtyRequested: l.qty_requested == null ? null : fromQty(l.qty_requested),
    qtySent: fromQty(l.qty_sent),
    qtyReceived: l.qty_received == null ? null : fromQty(l.qty_received),
    unitCost: toPounds(l.unit_cost ?? 0),
    batchNo: l.batch_no ?? null,
    expiryDate: l.expiry_date ?? null,
    match: l.match
      ? {
          productId: l.match.product_id,
          name: l.match.name,
          unit: l.match.unit,
          stock: fromQty(l.match.stock),
          allowDecimal: l.match.allow_decimal,
        }
      : null,
  })),
  local: d.local
    ? {
        pending: d.local.pending,
        lastError: d.local.last_error ?? null,
        stockOutApplied: d.local.stock_out_applied,
        stockInApplied: d.local.stock_in_applied,
      }
    : null,
  queued: d.queued,
  message: d.message,
});

const toStatus = (d: any): BranchStatus => ({
  connected: d.connected,
  serverUrl: d.server_url,
  branchName: d.branch_name,
  branchCode: d.branch_code,
  shopName: d.shop_name,
  pairedAt: d.paired_at,
  pending: d.pending ?? 0,
  reachable: d.reachable,
  isAdmin: Boolean(d.is_admin),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ---------- الطلبات ---------- */

const BASE = "/branch-sync";

export const fetchBranchStatus = async (check = false) =>
  toStatus((await api.get(`${BASE}/status`, { params: { check } })).data);

export const connectBranch = async (serverUrl: string, code: string) =>
  toStatus(
    (await api.post(`${BASE}/connect`, { server_url: serverUrl, code })).data,
  );

/** عنوان سيرفر الفروع الافتراضي (يُضبط وقت بناء البرنامج)، فلا يكتبه المالك بنفسه. */
export const DEFAULT_SYNC_URL = process.env.NEXT_PUBLIC_SYNC_URL ?? "";

export const registerShop = async (v: {
  serverUrl: string;
  licenseKey: string;
  branchName: string;
  branchCode: string;
  recover: boolean;
}) =>
  toStatus(
    (
      await api.post(`${BASE}/register`, {
        server_url: v.serverUrl,
        license_key: v.licenseKey,
        branch_name: v.branchName,
        branch_code: v.branchCode,
        recover: v.recover,
      })
    ).data,
  );

export const disconnectBranch = async () =>
  toStatus((await api.post(`${BASE}/disconnect`)).data);

export const fetchBranches = async (): Promise<Branch[]> =>
  (
    await api.get<
      {
        id: string;
        name: string;
        code: string;
        is_active: boolean;
        online: boolean;
        is_me: boolean;
      }[]
    >(`${BASE}/branches`)
  ).data.map((b) => ({
    id: b.id,
    name: b.name,
    code: b.code,
    isActive: b.is_active,
    online: b.online,
    isMe: b.is_me,
  }));

export async function fetchTransfers(
  direction: "in" | "out" | "all",
  status?: TransferStatus,
) {
  const { data } = await api.get(`${BASE}/transfers`, {
    params: { direction, status, page_size: 50 },
  });
  return {
    items: (data.items as unknown[]).map(toTransfer),
    total: data.total as number,
    pending: (data.pending_local as Record<string, unknown>[]).map((p) => ({
      id: p.id as string,
      toBranchName: p.to_branch_name as string,
      op: p.op as PendingLocal["op"],
      lastError: (p.last_error as string | null) ?? null,
      lines: p.lines as number,
    })),
  };
}

export const fetchTransfer = async (id: string) =>
  toTransfer((await api.get(`${BASE}/transfers/${id}`)).data);

export const fetchTransfersSummary = async (): Promise<TransfersSummary> =>
  (await api.get(`${BASE}/transfers/summary`)).data;

type LineInput = { productId: string; qty: number };
const lines = (items: LineInput[]) =>
  items.map((l) => ({ product_id: l.productId, qty: toQty(l.qty) }));

export const sendTransfer = async (
  toBranchId: string,
  items: LineInput[],
  note: string,
) =>
  toTransfer(
    (
      await api.post(`${BASE}/transfers`, {
        to_branch_id: toBranchId,
        lines: lines(items),
        note: note.trim() || null,
      })
    ).data,
  );

export const requestTransfer = async (
  fromBranchId: string,
  items: LineInput[],
  note: string,
) =>
  toTransfer(
    (
      await api.post(`${BASE}/transfers/requests`, {
        from_branch_id: fromBranchId,
        lines: lines(items),
        note: note.trim() || null,
      })
    ).data,
  );

export const approveTransfer = async (
  id: string,
  items: { lineId: string; qty: number; productId?: string }[],
) =>
  toTransfer(
    (
      await api.post(`${BASE}/transfers/${id}/approve`, {
        lines: items.map((l) => ({
          line_id: l.lineId,
          qty: toQty(l.qty),
          product_id: l.productId ?? null,
        })),
      })
    ).data,
  );

export const receiveTransfer = async (
  id: string,
  items: { lineId: string; qty: number; productId?: string }[],
  note: string,
) =>
  toTransfer(
    (
      await api.post(`${BASE}/transfers/${id}/receive`, {
        lines: items.map((l) => ({
          line_id: l.lineId,
          qty_received: toQty(l.qty),
          product_id: l.productId ?? null,
        })),
        note: note.trim() || null,
      })
    ).data,
  );

export const rejectTransfer = async (id: string, reason: string) =>
  toTransfer(
    (await api.post(`${BASE}/transfers/${id}/reject`, { reason })).data,
  );

export const withdrawTransfer = async (id: string) =>
  toTransfer((await api.post(`${BASE}/transfers/${id}/withdraw`)).data);

export const cancelTransfer = async (id: string) =>
  toTransfer((await api.post(`${BASE}/transfers/${id}/cancel`)).data);

export const retryPending = async () =>
  (await api.post(`${BASE}/transfers/retry`)).data as { sent: number };

/* ---------- مزامنة الأصناف والعملاء ---------- */

export interface CatalogSyncError {
  kind: "product" | "customer" | "owner";
  name: string;
  error: string;
  localId: string | null;
}

export interface CatalogStatus {
  connected: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  products: number;
  customers: number;
  owners: number;
  errorCount: number;
  errors: CatalogSyncError[];
  /** نتيجة آخر دورة (من «مزامنة الآن» فقط). */
  result?: {
    ok: boolean;
    pulled: number;
    applied: number;
    pushed: number;
    errors: number;
    unpaired?: boolean;
    error?: string;
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- شكل الرد مكتوب في الـ backend */
const toCatalog = (d: any): CatalogStatus => ({
  connected: Boolean(d.connected),
  lastSyncAt: d.last_sync_at ?? null,
  lastError: d.last_error ?? null,
  products: d.products ?? 0,
  customers: d.customers ?? 0,
  owners: d.owners ?? 0,
  errorCount: d.error_count ?? 0,
  errors: (d.errors ?? []).map((e: any) => ({
    kind: e.kind,
    name: e.name ?? "",
    error: e.error ?? "",
    localId: e.local_id ?? null,
  })),
  result: d.result,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export const fetchCatalogStatus = async () =>
  toCatalog((await api.get(`${BASE}/catalog`)).data);

export const syncCatalogNow = async () =>
  toCatalog((await api.post(`${BASE}/catalog/sync`)).data);

/* ---------- إدارة فروع المحل (المالك من الفرع الرئيسي) ---------- */

export interface ShopBranch {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isAdmin: boolean;
  isMe: boolean;
  online: boolean;
  /** فيه جهاز مربوط بهذا الفرع حالياً. */
  paired: boolean;
  lastSeenAt: string | null;
}

export interface PairingCode {
  branchId: string;
  branchName: string;
  code: string;
  expiresAt: string;
}

export interface ShopInfo {
  shopName: string;
  isAdmin: boolean;
  licensePlan: string | null;
  licenseExpiresAt: string | null;
  branches: number;
  maxBranches: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- شكل الرد مكتوب في الـ backend */
const toShopBranch = (b: any): ShopBranch => ({
  id: b.id,
  name: b.name,
  code: b.code,
  isActive: b.is_active,
  isAdmin: b.is_admin,
  isMe: b.is_me,
  online: b.online,
  paired: b.paired,
  lastSeenAt: b.last_seen_at ?? null,
});

const toPairing = (c: any): PairingCode => ({
  branchId: c.branch_id,
  branchName: c.branch_name,
  code: c.code,
  expiresAt: c.expires_at,
});

const toShopInfo = (d: any): ShopInfo => ({
  shopName: d.shop_name,
  isAdmin: d.is_admin,
  licensePlan: d.license_plan ?? null,
  licenseExpiresAt: d.license_expires_at ?? null,
  branches: d.branches,
  maxBranches: d.max_branches,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export const fetchShopInfo = async () =>
  toShopInfo((await api.get(`${BASE}/shop`)).data);

export const fetchShopBranches = async (): Promise<ShopBranch[]> =>
  (await api.get<unknown[]>(`${BASE}/shop/branches`)).data.map(toShopBranch);

export const createShopBranch = async (name: string, code: string) => {
  const d = (await api.post(`${BASE}/shop/branches`, { name, code })).data;
  return { branch: toShopBranch(d.branch), pairing: toPairing(d.pairing) };
};

export const createPairingCode = async (branchId: string) =>
  toPairing(
    (await api.post(`${BASE}/shop/branches/${branchId}/pairing-code`)).data,
  );

export const updateShopBranch = async (
  branchId: string,
  patch: { name?: string; isActive?: boolean },
) =>
  toShopBranch(
    (
      await api.patch(`${BASE}/shop/branches/${branchId}`, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}),
      })
    ).data,
  );

export const revokeShopBranch = async (branchId: string) =>
  toShopBranch(
    (await api.post(`${BASE}/shop/branches/${branchId}/revoke`)).data,
  );

export const renewShopLicense = async (licenseKey: string) =>
  toShopInfo(
    (await api.post(`${BASE}/shop/license`, { license_key: licenseKey })).data,
  );
