"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/firebase/firebase";
import { setProducts } from "@/features/products/slices/productsSlice";
import { ProductType } from "../types/ProductType";
import { AppDispatch } from "@/store/store";

export default function useRealtimeProducts() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const productsRef = collection(db, `users/${uid}/products`);

    // 🔥 استماع لحظي لتغييرات المنتجات
    const unsubscribe = onSnapshot(productsRef, (snapshot) => {
      const products: ProductType[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProductType[];

      dispatch(setProducts(products));
    });

    return () => unsubscribe(); // تنظيف عند الخروج
  }, [dispatch]);
}
