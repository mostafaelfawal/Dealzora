"use client";

import HeaderPage from "@/components/HeaderPage";
import { FaBoxes } from "react-icons/fa";

export default function InventoryPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <HeaderPage title="ادارة المخزون" Icon={FaBoxes} />
    </div>
  );
}
