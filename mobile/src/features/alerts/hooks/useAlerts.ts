import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Alert } from "react-native";

import { errorMessage } from "@/api/errors";
import type { NotificationPrefs } from "@/api/types";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";

import { fetchNotifications, fetchPrefs, markRead, savePrefs } from "../api/alerts.api";
import { notifyNewAlerts } from "../lib/localNotify";
import { utcOffsetMinutes } from "../lib/push";
import { usePushState } from "../lib/pushStore";

export const alertKeys = {
  list: ["alerts", "list"] as const,
  prefs: ["alerts", "prefs"] as const,
};

export function useNotifications() {
  const live = useLiveRefresh(true);
  return useQuery({ queryKey: alertKeys.list, queryFn: ({ signal }) => fetchNotifications(signal), ...live });
}

/**
 * عدد غير المقروء لشارة التبويب (كل دقيقة والتطبيق مفتوح). وبدون push من الخادم (Expo Go): كل تنبيه جديد
 * يظهر كإشعار حقيقي في شريط الهاتف (localNotify).
 */
export function useUnreadCount(): number {
  const q = useQuery({ queryKey: alertKeys.list, queryFn: ({ signal }) => fetchNotifications(signal), refetchInterval: 60_000 });
  const push = usePushState();
  useEffect(() => {
    if (push === "local" && q.data) void notifyNewAlerts(q.data.items);
  }, [push, q.data]);
  return q.data?.unread ?? 0;
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => markRead(ids),
    onSuccess: (list) => qc.setQueryData(alertKeys.list, list),
  });
}

export function usePrefs() {
  return useQuery({ queryKey: alertKeys.prefs, queryFn: ({ signal }) => fetchPrefs(signal) });
}

export function useSavePrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPrefs) => savePrefs(prefs, utcOffsetMinutes()),
    // تحديث فوري للشاشة، والرجوع للقيمة السابقة لو فشل الحفظ.
    onMutate: async (prefs) => {
      await qc.cancelQueries({ queryKey: alertKeys.prefs });
      const previous = qc.getQueryData<NotificationPrefs>(alertKeys.prefs);
      qc.setQueryData(alertKeys.prefs, prefs);
      return { previous };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(alertKeys.prefs, ctx.previous);
      Alert.alert("لم تُحفظ الإعدادات", errorMessage(e));
    },
    onSuccess: (saved) => qc.setQueryData(alertKeys.prefs, saved),
  });
}
