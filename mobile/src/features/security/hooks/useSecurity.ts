import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

import { errorMessage } from "@/api/errors";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

import {
  createPairingCode,
  fetchDevices,
  fetchShopSessions,
  fetchStaff,
  revokeDevice,
  revokeShopSession,
  setStaffActive,
} from "../api/security.api";

export const securityKeys = {
  staff: ["security", "staff"] as const,
  devices: ["security", "devices"] as const,
  sessions: ["security", "sessions"] as const,
};

/** الشاشات للمالك فقط: لا نطلب شيئاً لغيره أصلاً. */
export function useIsOwner(): boolean {
  return useAuth().user?.role === "owner";
}

const fail = (title: string) => (e: unknown) =>
  Alert.alert(title, errorMessage(e));

export function useStaff() {
  const owner = useIsOwner();
  return useQuery({
    queryKey: securityKeys.staff,
    queryFn: ({ signal }) => fetchStaff(signal),
    enabled: owner,
  });
}

export function useSetStaffActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      setStaffActive(v.id, v.active),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: securityKeys.staff }),
    onError: fail("تعذّر تغيير حالة الموظف"),
  });
}

export function useDevices() {
  const owner = useIsOwner();
  const live = useLiveRefresh(true);
  return useQuery({
    queryKey: securityKeys.devices,
    queryFn: ({ signal }) => fetchDevices(signal),
    enabled: owner,
    ...live,
  });
}

export function useRevokeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeDevice,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: securityKeys.devices }),
    onError: fail("تعذّر إلغاء ربط الجهاز"),
  });
}

export function usePairingCode() {
  return useMutation({
    mutationFn: createPairingCode,
    onError: fail("تعذّر إصدار كود الربط"),
  });
}

export function useShopSessions() {
  const owner = useIsOwner();
  return useQuery({
    queryKey: securityKeys.sessions,
    queryFn: ({ signal }) => fetchShopSessions(signal),
    enabled: owner,
  });
}

export function useRevokeShopSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeShopSession,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: securityKeys.sessions }),
    onError: fail("تعذّر إلغاء الجلسة"),
  });
}
