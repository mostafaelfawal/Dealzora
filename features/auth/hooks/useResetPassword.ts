import { auth } from "@/firebase/firebase";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { useEffect, useState } from "react";

export default function useResetPassword() {
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;

    const id = setInterval(() => setCooldown((v) => v - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setCooldown(59);
      return true;
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === "auth/user-not-found") setError("البريد غير مسجل.");
        else if (err.code === "auth/invalid-email")
          setError("البريد غير صالح.");
        else setError("حدث خطأ غير متوقع.");
      } else {
        setError("حدث خطأ غير معروف.");
      }
      return false;
    }
  };

  return { resetPassword, error, cooldown };
}
