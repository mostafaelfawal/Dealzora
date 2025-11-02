"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/store/store";
import SearchContainer from "@/features/suppliers/components/SearchContainer";
import {
  startListeningToSuppliers,
} from "@/features/suppliers/slices/supplierListener";

export default function InventoryPage() {
  const dispatch = useDispatch<AppDispatch>();
  const suppliers = useSelector(
    (state: RootState) => state.suppliers.suppliers
  );

  useEffect(() => {
    startListeningToSuppliers(dispatch);
  }, [dispatch]);

  return (
    <>
      <SearchContainer />
      <ul>
        {suppliers.map((s, i) => (
          <li key={i}>{s.name}</li>
        ))}
      </ul>
    </>
  );
}
