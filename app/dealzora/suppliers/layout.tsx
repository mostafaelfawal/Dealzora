"use client";
import {
  startListeningToSuppliers,
} from "@/features/suppliers/slices/supplierListener";
import { AppDispatch } from "@/store/store";
import React, { useEffect } from "react";
import { useDispatch } from "react-redux";

export default function SuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    dispatch(startListeningToSuppliers);
  }, [dispatch]);

  return <>{children}</>;
}
