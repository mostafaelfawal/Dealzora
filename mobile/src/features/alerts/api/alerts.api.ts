import { api } from "@/api/instance";
import type { NotificationList, NotificationPrefs } from "@/api/types";

export const fetchNotifications = (signal?: AbortSignal) =>
  api.get<NotificationList>("/notifications", signal);

/** ids فارغة = تعليم الكل كمقروء. */
export const markRead = (ids?: string[]) =>
  api.post<NotificationList>("/notifications/read", { ids: ids ?? null });

export const fetchPrefs = (signal?: AbortSignal) =>
  api.get<NotificationPrefs>("/notification-prefs", signal);

export function savePrefs(
  prefs: NotificationPrefs,
  utcOffset: number,
): Promise<NotificationPrefs> {
  const { push_on_this_device: _ignored, ...body } = prefs;
  return api.request<NotificationPrefs>("/notification-prefs", {
    method: "PUT",
    body: { ...body, utc_offset_minutes: utcOffset },
  });
}
