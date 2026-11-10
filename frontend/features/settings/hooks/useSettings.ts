import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import {
  changePassword,
  createBackup,
  fetchBackups,
  fetchBackupStatus,
  fetchLicense,
  fetchShopName,
  renameShop,
} from "../api/settings.api";

export const settingsKeys = {
  backupStatus: ["backup", "status"] as const,
  backups: ["backup", "list"] as const,
  shop: ["shop"] as const,
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
