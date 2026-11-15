/** تخزين التوكنات في SecureStore فقط (لا AsyncStorage ولا ذاكرة دائمة غيره). */
import type { TokenStore } from "@/api/client";
import type { StoredTokens } from "@/api/types";
import { SECURE_KEYS, secureDelete, secureGet, secureSet } from "@/lib/secureStore";

function parse(raw: string | null): StoredTokens | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredTokens>;
    if (
      typeof value.access_token === "string" &&
      typeof value.refresh_token === "string" &&
      typeof value.expires_at === "string" &&
      typeof value.session_id === "string"
    ) {
      return value as StoredTokens;
    }
  } catch {
    // قيمة تالفة ← كأن لا جلسة
  }
  return null;
}

export const secureTokenStore: TokenStore = {
  async load() {
    return parse(await secureGet(SECURE_KEYS.tokens));
  },
  async save(tokens) {
    await secureSet(SECURE_KEYS.tokens, JSON.stringify(tokens));
  },
  async clear() {
    await secureDelete(SECURE_KEYS.tokens);
  },
};
