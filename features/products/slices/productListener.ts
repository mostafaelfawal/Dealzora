// productsListener.ts
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/firebase/firebase";
import { AppDispatch } from "@/store/store";
import { ProductType } from "../types/ProductType";
import { setError, setLoading, setProducts } from "./productsSlice";

let unsubscribeListener: null | (() => void) = null;

export const startListeningToProducts = (dispatch: AppDispatch) => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    dispatch(setError("لم يتم تسجيل الدخول"));
    return;
  }

  if (unsubscribeListener) return;

  dispatch(setLoading());
  const productsRef = collection(db, `users/${uid}/products`);

  unsubscribeListener = onSnapshot(
    productsRef,
    (snapshot) => {
      const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProductType[];

      dispatch(setProducts(products));
    },
    (error) => {
      console.error(error);
      dispatch(setError("فشل في جلب البيانات"));
    }
  );
};
