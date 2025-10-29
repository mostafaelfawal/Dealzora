import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaShoppingBag, FaHome, FaBoxes } from "react-icons/fa";

export default function MenuLinks({
  hovered,
  onClick,
}: {
  hovered: boolean;
  onClick?: VoidFunction;
}) {
  const menuItems = [
    { name: "لوحة التحكم", icon: <FaHome />, href: "/dealzora/dashboard" },
    { name: "المنتجات", icon: <FaShoppingBag />, href: "/dealzora/products" },
    { name: "المخزون", icon: <FaBoxes />, href: "/dealzora/inventory" },
  ];
  const path = usePathname();
  return (
    <nav className="flex-1 flex flex-col gap-2 p-3 text-sm text-right">
      {menuItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          className={`flex items-center gap-3 p-3 rounded-lg ${
            path === item.href ? "bg-blue-500" : "hover:bg-blue-500"
          } transition ${!hovered && "justify-center"}`}
        >
          {item.icon}
          {hovered && <span>{item.name}</span>}
        </Link>
      ))}
    </nav>
  );
}
