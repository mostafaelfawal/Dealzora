interface Props {
  status: "موجود" | "منتهي" | "قليل";
}

export default function ProductStatusBadge({ status }: Props) {
  const statusColors = {
    موجود: "bg-green-100 text-green-700",
    منتهي: "bg-red-100 text-red-700",
    قليل: "bg-yellow-100 text-yellow-700",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[status]}`}
    >
      {status}
    </span>
  );
}
