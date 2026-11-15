/** أمان المحل (المالك فقط: الخادم يرد 403 owner_only لغيره). */
import { api } from "@/api/instance";
import type { BranchDevice, PairingCode, ShopSession, StaffMember } from "@/api/types";

const enc = encodeURIComponent;

export const fetchStaff = (signal?: AbortSignal) => api.get<StaffMember[]>("/admin/staff", signal);
export const setStaffActive = (id: string, active: boolean) =>
  api.post<StaffMember>(`/admin/staff/${enc(id)}/${active ? "activate" : "deactivate"}`);

export const fetchDevices = (signal?: AbortSignal) => api.get<BranchDevice[]>("/admin/devices", signal);
export const revokeDevice = (branchId: string) => api.post<BranchDevice>(`/admin/devices/${enc(branchId)}/revoke`);
export const createPairingCode = (branchId: string) =>
  api.post<PairingCode>(`/admin/devices/${enc(branchId)}/pairing-code`);

export const fetchShopSessions = (signal?: AbortSignal) => api.get<ShopSession[]>("/admin/sessions", signal);
export const revokeShopSession = (id: string) => api.post<void>(`/admin/sessions/${enc(id)}/revoke`);
