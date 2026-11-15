import { useSyncExternalStore } from "react";

import { getAuthState, subscribeAuth, type AuthState } from "../lib/authStore";

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState, getAuthState);
}
