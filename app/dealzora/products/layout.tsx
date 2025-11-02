"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import { startListeningToProducts } from "@/features/products/slices/productListener";
import { AppDispatch, RootState } from "@/store/store";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const { error, loading } = useSelector((state: RootState) => state.products);

  useEffect(() => {
    startListeningToProducts(dispatch);
  }, [dispatch]);

  useEffect(() => {
    if (error) toast.error(error);
  });

  if (loading)
    return (
      <div className="h-screen flex justify-center items-center">
        <div>
          <LoadingSpinner />
          <p className="animate-pulse">جاري تحميل المنتجات...</p>
        </div>
      </div>
    );

  return <>{children}</>;
}
