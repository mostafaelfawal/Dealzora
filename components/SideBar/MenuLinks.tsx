import Link from "next/link";
import { FaBox, FaChartBar, FaHome, FaUsers } from "react-icons/fa";

export default function MenuLinks({
  hovered,
  onClick,
}: {
  hovered: boolean;
  onClick?: () => void;
}) {
  const menuItems = [
    { name: "لوحة التحكم", icon: <FaHome />, href: "/dashboard" },
    { name: "المنتجات", icon: <FaBox />, href: "/products" },
    { name: "العملاء", icon: <FaUsers />, href: "/customers" },
    { name: "التقارير", icon: <FaChartBar />, href: "/reports" },
  ];
  return (
    <nav className="flex-1 flex flex-col gap-2 p-3 text-sm text-right">
      {menuItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          className={`flex items-center gap-3 p-3 rounded-lg hover:bg-blue-500 transition ${
            !hovered && "justify-center"
          }`}
        >
          {hovered && <span>{item.name}</span>}
          {item.icon}
        </Link>
      ))}
    </nav>
  );
}
