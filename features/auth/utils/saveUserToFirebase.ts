import { auth, db } from "@/firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { UserType } from "../types/UserType";
import { FirebaseError } from "firebase/app";

export default async function saveUserToFirebase({
  name,
  avatar,
  email,
}: UserType) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("لم يتم العثور على المستخدم الحالي");

    const userRef = doc(db, "users", uid);

    //  إزالة القيم الفارغة تلقائيًا
    const filteredData = Object.fromEntries(
      Object.entries({ name, avatar, email }).filter(([, value]) => value)
    );

    await setDoc(userRef, filteredData, { merge: true });
  } catch (err) {
    if (err instanceof FirebaseError) {
      throw new Error(err.message);
    }
    throw err;
  }
}
