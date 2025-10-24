import { auth } from "@/firebase/firebase";
import { FirebaseError } from "firebase/app";
import { signInWithPopup } from "firebase/auth";
import { useState } from "react";
import { AuthProviderClass } from "../types/AuthProviderClass";
import saveUserToFirebase from "../utils/saveUserToFirebase";

export default function useLoginWithProvider() {
  const [providerLoading, setProviderLoading] = useState<boolean>(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  const loginWithProvider = async (
    Provider: AuthProviderClass
  ): Promise<boolean> => {
    try {
      setProviderLoading(true);
      const provider = new Provider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await saveUserToFirebase({
        name: user.displayName,
        avatar: user.photoURL,
        email: user.email,
      });
      return true;
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case "auth/account-exists-with-different-credential":
            setProviderError("البريد الإلكتروني مستخدم بطريقة تسجيل مختلفة");
            break;
          case "auth/popup-closed-by-user":
            setProviderError("تم إغلاق النافذة قبل تسجيل الدخول");
            break;
          default:
            setProviderError("حدث خطأ غير متوقع");
        }
      }
      return false;
    } finally {
      setProviderLoading(false);
    }
  };

  return { loginWithProvider, providerLoading, providerError };
}
