import { auth } from "@/firebase/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import saveUserToFirebase from "../utils/saveUserToFirebase";
import { FirebaseError } from "firebase/app";

export default function useRegisterWithEmail() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signin = async (email: string, password: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await saveUserToFirebase({
        name,
        avatar: user.photoURL,
        email: user.email,
      });
      return true
    } catch (err: unknown) {
      if (
        err instanceof FirebaseError &&
        err.code === "auth/email-already-in-use"
      ) {
        setError("البريد الألكتروني مستخدم بالفعل");
      } else {
        setError("حدث خطأ غير متوقع");
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { signin, loading, error };
}
