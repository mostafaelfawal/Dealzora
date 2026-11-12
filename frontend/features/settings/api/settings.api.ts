import { isTauri } from "@tauri-apps/api/core";

import { toMs, toMsOrNull } from "@/lib/apiMap";
import { api } from "@/lib/axios";
import type { Currency } from "@/lib/currency";
import { setPaymentAccounts, type PaymentAccounts } from "@/lib/payments";
import { getLicenseStatus } from "@/features/setup/lib/license";
import type { LicenseStatus } from "@/features/setup/types/setup";

/* ---------- النسخ الاحتياطي ---------- */

export interface BackupLocation {
  /** المجلد المستخدم فعلاً الآن. */
  path: string;
  defaultPath: string;
  isDefault: boolean;
  /** المجلد المحدد غير متاح (فلاشة مفصولة)، والنسخ تُكتب مؤقتاً في الافتراضي. */
  fallback: boolean;
  configured: string | null;
}

export interface BackupStatus {
  lastBackupAt: number | null;
  count: number;
  autoEveryHours: number;
  keep: number;
  /** للمدير فقط. */
  location: BackupLocation | null;
}

export interface BackupFile {
  name: string;
  size: number;
  createdAt: number;
}

interface BackupLocationDto {
  path: string;
  default_path: string;
  is_default: boolean;
  fallback: boolean;
  configured: string | null;
}

interface BackupStatusDto {
  last_backup_at: string | null;
  count: number;
  pending_sync: number;
  auto_every_hours: number;
  keep: number;
  location: BackupLocationDto | null;
}

const toLocation = (d: BackupLocationDto): BackupLocation => ({
  path: d.path,
  defaultPath: d.default_path,
  isDefault: d.is_default,
  fallback: d.fallback,
  configured: d.configured,
});

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
    autoEveryHours: data.auto_every_hours,
    keep: data.keep,
    location: data.location ? toLocation(data.location) : null,
  };
};

export const fetchBackups = async (): Promise<BackupFile[]> =>
  (await api.get<BackupDto[]>("/backup")).data.map(toBackup);

export const createBackup = async (): Promise<BackupFile> =>
  toBackup((await api.post<BackupDto>("/backup")).data);

/** null = الرجوع للمجلد الافتراضي. السيرفر يتأكد أنه قابل للكتابة ويأخذ نسخة فيه فوراً. */
export const setBackupLocation = async (
  path: string | null,
): Promise<BackupLocation> =>
  toLocation(
    (await api.put<BackupLocationDto>("/backup/location", { path })).data,
  );

/** نسخة من القائمة (name) أو ملف من مكان آخر (path). يرجع اسم نسخة الأمان. */
export const restoreBackup = async (
  source: { name: string } | { path: string },
): Promise<string> =>
  (await api.post<{ safety_backup: string }>("/backup/restore", source)).data
    .safety_backup;

/* ---------- العملة ---------- */

interface PaymentAccountsDto {
  vodafone_cash: string | null;
  instapay: string | null;
}

const toAccounts = (d: PaymentAccountsDto | undefined): PaymentAccounts => ({
  vodafoneCash: d?.vodafone_cash ?? null,
  instapay: d?.instapay ?? null,
});

/** GET /settings يرجّع العملة وحسابات الدفع معاً، فنحدّث مخزن الحسابات هنا أيضاً. */
export const fetchCurrency = async (): Promise<Currency> => {
  const { data } = await api.get<{
    currency: Currency;
    payments?: PaymentAccountsDto;
  }>("/settings");
  setPaymentAccounts(toAccounts(data.payments));
  return data.currency;
};

/* ---------- حسابات الدفع الإلكتروني ---------- */

export const savePaymentAccounts = async (
  accounts: PaymentAccounts,
): Promise<PaymentAccounts> =>
  toAccounts(
    (
      await api.put<PaymentAccountsDto>("/settings/payments", {
        vodafone_cash: accounts.vodafoneCash,
        instapay: accounts.instapay,
      })
    ).data,
  );

export const saveCurrency = async (currency: Currency): Promise<Currency> =>
  (await api.put<Currency>("/settings/currency", currency)).data;

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
