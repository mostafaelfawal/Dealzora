import { auth } from "@/firebase/firebase";
import { FirebaseError } from "firebase/app";
import { signOut } from "firebase/auth";
import { useState } from "react";

export default function useLogout() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const logout = async () => {
    setLoading(true);
    try {
      setError(null);
      await signOut(auth);
      return true;
    } catch (err) {
      if (err instanceof FirebaseError) setError(err.message);
      else setError("حدث خطأ غير متوقع");
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { logout, error, loading };
}
