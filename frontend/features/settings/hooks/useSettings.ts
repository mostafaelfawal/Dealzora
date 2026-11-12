import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { setCurrency, type Currency } from "@/lib/currency";
import { setPaymentConfig, type PaymentConfig } from "@/lib/payments";
import { extractErrorMessage } from "@/lib/errors";

import {
  changePassword,
  createBackup,
  fetchBackups,
  fetchBackupStatus,
  fetchLicense,
  fetchCurrency,
  fetchShopName,
  renameShop,
  restoreBackup,
  saveCurrency,
  savePaymentConfig,
  setBackupLocation,
} from "../api/settings.api";

export const settingsKeys = {
  backupStatus: ["backup", "status"] as const,
  backups: ["backup", "list"] as const,
  shop: ["shop"] as const,
  currency: ["settings", "currency"] as const,
  license: ["license"] as const,
};

export function useBackupStatus() {
  return useQuery({
    queryKey: settingsKeys.backupStatus,
    queryFn: fetchBackupStatus,
    refetchInterval: 5 * 60_000,
  });
}

export function useBackups(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.backups,
    queryFn: fetchBackups,
    enabled,
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["backup"] });
      toast.success("تم إنشاء نسخة احتياطية مشفّرة");
    },
    onError: (e) =>
      toast.error(extractErrorMessage(e, "تعذّر إنشاء النسخة الاحتياطية")),
  });
}

export function useShopName() {
  return useQuery({
    queryKey: settingsKeys.shop,
    queryFn: fetchShopName,
    staleTime: 10 * 60_000,
  });
}

export function useRenameShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: renameShop,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: settingsKeys.shop });
      toast.success("تم حفظ اسم المحل");
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حفظ اسم المحل")),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      changePassword(current, next),
    onSuccess: () => toast.success("تم تغيير كلمة المرور"),
    onError: (e) =>
      toast.error(extractErrorMessage(e, "تعذّر تغيير كلمة المرور")),
  });
}

export function useLicense() {
  return useQuery({
    queryKey: settingsKeys.license,
    queryFn: fetchLicense,
    staleTime: 30 * 60_000,
    retry: false,
  });
}

/* ---------- العملة ---------- */

/** يقرأ عملة المحل من القاعدة ويطبّقها على كل الشاشات. */
export function useCurrencySetting() {
  return useQuery({
    queryKey: settingsKeys.currency,
    queryFn: async () => {
      const currency = await fetchCurrency();
      setCurrency(currency);
      return currency;
    },
    staleTime: 10 * 60_000,
  });
}

export function useSaveCurrency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (currency: Currency) => saveCurrency(currency),
    onSuccess: (currency) => {
      setCurrency(currency);
      qc.setQueryData(settingsKeys.currency, currency);
      toast.success(`العملة الآن: ${currency.name} (${currency.symbol})`);
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حفظ العملة")),
  });
}

export function useSavePaymentConfig() {
  return useMutation({
    mutationFn: (config: PaymentConfig) => savePaymentConfig(config),
    onSuccess: (config) => {
      setPaymentConfig(config);
      const active = config.methods.filter((m) => m.enabled);
      toast.success("تم حفظ طرق الدفع", {
        description: active.length
          ? `تظهر الآن في الكاشير: ${active.map((m) => m.name).join("، ")}`
          : "الدفع الإلكتروني متوقف في الكاشير.",
      });
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حفظ طرق الدفع")),
  });
}

/* ---------- مكان النسخ والاستعادة ---------- */

export function useSetBackupLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string | null) => setBackupLocation(path),
    onSuccess: (loc) => {
      void qc.invalidateQueries({ queryKey: ["backup"] });
      toast.success(
        loc.isDefault
          ? "رجعنا للمجلد الافتراضي، وأُخذت نسخة فيه الآن"
          : "تم حفظ المكان الجديد، وأُخذت أول نسخة فيه الآن",
        { description: loc.path },
      );
    },
    onError: (e) => toast.error(extractErrorMessage(e, "تعذّر حفظ المكان")),
  });
}

export function useRestoreBackup() {
  return useMutation({
    mutationFn: restoreBackup,
    onError: (e) =>
      toast.error(extractErrorMessage(e, "تعذّرت الاستعادة"), {
        duration: 10_000,
      }),
  });
}
