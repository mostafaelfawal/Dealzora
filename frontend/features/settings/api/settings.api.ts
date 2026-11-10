import { isTauri } from "@tauri-apps/api/core";

import { toMs, toMsOrNull } from "@/lib/apiMap";
import { api } from "@/lib/axios";
import { getLicenseStatus } from "@/features/setup/lib/license";
import type { LicenseStatus } from "@/features/setup/types/setup";

/* ---------- النسخ الاحتياطي ---------- */

export interface BackupStatus {
  lastBackupAt: number | null;
  count: number;
  pendingSync: number;
  autoEveryHours: number;
  keep: number;
}

export interface BackupFile {
  name: string;
  size: number;
  createdAt: number;
}

interface BackupStatusDto {
  last_backup_at: string | null;
  count: number;
  pending_sync: number;
  auto_every_hours: number;
  keep: number;
}

interface BackupDto {
  name: string;
  size: number;
  created_at: string;
}

const toBackup = (d: BackupDto): BackupFile => ({
  name: d.name,
  size: d.size,
  createdAt: toMs(d.created_at),
});

export const fetchBackupStatus = async (): Promise<BackupStatus> => {
  const { data } = await api.get<BackupStatusDto>("/backup/status");
  return {
    lastBackupAt: toMsOrNull(data.last_backup_at),
    count: data.count,
    pendingSync: data.pending_sync,
    autoEveryHours: data.auto_every_hours,
    keep: data.keep,
  };
};

export const fetchBackups = async (): Promise<BackupFile[]> =>
  (await api.get<BackupDto[]>("/backup")).data.map(toBackup);

export const createBackup = async (): Promise<BackupFile> =>
  toBackup((await api.post<BackupDto>("/backup")).data);

/* ---------- المحل ---------- */

export const fetchShopName = async (): Promise<string | null> =>
  (await api.get<{ name: string | null }>("/shop")).data.name;

export const renameShop = async (name: string): Promise<string | null> =>
  (await api.patch<{ name: string | null }>("/shop", { name })).data.name;

/* ---------- الحساب ---------- */

export const changePassword = async (current: string, next: string) => {
  await api.post("/auth/change-password", {
    current_password: current,
    new_password: next,
  });
};

export const logout = async () => {
  await api.post("/auth/logout");
};

/* ---------- الترخيص (من Rust) ---------- */

/** null خارج تطبيق سطح المكتب (المتصفح أثناء التطوير). */
export const fetchLicense = async (): Promise<LicenseStatus | null> =>
  isTauri() ? getLicenseStatus() : null;
