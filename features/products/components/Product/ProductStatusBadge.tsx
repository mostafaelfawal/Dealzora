"use client";

import { useMemo } from "react";

interface Props {
  stock?: number;
  stockAlert?: number;
}

export default function ProductStatusBadge({ stock, stockAlert }: Props) {
  const statusColors = {
    موجود: "bg-green-100 text-green-700",
    منتهي: "bg-red-100 text-red-700",
    قليل: "bg-yellow-100 text-yellow-700",
  };
  const result = useMemo(() => {
    if (stock == null || stock <= 0) return "منتهي";
    if (stockAlert != null && stock <= stockAlert) return "قليل";
    return "موجود";
  }, [stock, stockAlert]);

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold flex justify-center items-center ${statusColors[result]}`}
    >
      {result}
    </span>
  );
}
