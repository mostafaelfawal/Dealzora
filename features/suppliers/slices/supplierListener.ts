import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/firebase/firebase";
import { AppDispatch } from "@/store/store";
import { setError, setLoading, setSuppliers } from "./suppliersSlice";
import { SupplierType } from "../types/SupplierType";

let unsubscribeListener: null | (() => void) = null;

export const startListeningToSuppliers = (dispatch: AppDispatch) => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    dispatch(setError("لم يتم تسجيل الدخول"));
    return;
  }

  if (unsubscribeListener) return;

  dispatch(setLoading());

  const suppliersRef = collection(db, `users/${uid}/suppliers`);
  unsubscribeListener = onSnapshot(
    suppliersRef,
    (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SupplierType[];

      dispatch(setSuppliers(data));
    },
    (error) => {
      console.error(error);
      dispatch(setError("فشل في جلب البيانات"));
    }
  );
};
