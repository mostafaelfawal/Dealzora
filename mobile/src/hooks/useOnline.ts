/**
 * حالة الاتصال من expo-network. «غير متصل» = لا شبكة، أو شبكة بلا إنترنت (واي فاي بلا خط).
 * isInternetReachable قد تكون undefined في البداية: نعتبرها متصلة حتى يثبت العكس.
 */
import { useNetworkState, type NetworkState } from "expo-network";

export function isOnlineState(state: Pick<NetworkState, "isConnected" | "isInternetReachable">): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function useOnline(): boolean {
  return isOnlineState(useNetworkState());
}
