"use client";

import HeaderPage from "@/components/HeaderPage";
import { FaTruck } from "react-icons/fa";

export default function InventoryPage() {
  return (
    <>
      {/* Header */}
      <HeaderPage title="ادارة الموردين" Icon={FaTruck} />
    </>
  );
}
