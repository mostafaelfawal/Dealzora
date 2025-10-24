import { auth } from "@/firebase/firebase";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useState } from "react";
import { FirebaseError } from "firebase/app";
import saveUserToFirebase from "../utils/saveUserToFirebase";

export default function useLoginWithEmail() {
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [errorLogin, setErrorLogin] = useState<string | null>(null);

  const login = async (email: string, password: string, remember: boolean) => {
    setLoadingLogin(true);
    setErrorLogin(null);
    try {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
      );

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await saveUserToFirebase({
        name: user.displayName,
        email: user.email,
        avatar: user.photoURL,
      });

      return true;
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case "auth/invalid-credential":
          case "auth/wrong-password":
          case "auth/user-not-found":
            setErrorLogin("بيانات الدخول غير صحيحة");
            break;
          case "auth/too-many-requests":
            setErrorLogin("تم حظر المحاولات مؤقتًا. حاول لاحقًا");
            break;
          default:
            setErrorLogin("حدث خطأ غير متوقع");
        }
      }
      return false;
    } finally {
      setLoadingLogin(false);
    }
  };

  return { login, loadingLogin, errorLogin };
}
