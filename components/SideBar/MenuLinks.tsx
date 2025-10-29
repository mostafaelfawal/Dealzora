"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaShoppingBag,
  FaHome,
  FaBoxes,
  FaTruck,
  FaFileInvoice,
  FaExchangeAlt,
  FaWarehouse,
  FaChevronDown,
} from "react-icons/fa";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type MenuItem = {
  name: string;
  icon: React.ReactElement;
  href?: string;
  submenu?: MenuItem[];
};

export default function MenuLinks({
  hovered,
  onClick,
}: {
  hovered: boolean;
  onClick?: VoidFunction;
}) {
  const path = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const menu: MenuItem[] = [
    { name: "لوحة التحكم", icon: <FaHome />, href: "/dealzora/dashboard" },
    { name: "المنتجات", icon: <FaShoppingBag />, href: "/dealzora/products" },
    {
      name: "المخزون",
      icon: <FaBoxes />,
      submenu: [
        {
          name: "الموردين",
          icon: <FaTruck />,
          href: "/dealzora/inventory/suppliers",
        },
        {
          name: "المشتريات",
          icon: <FaFileInvoice />,
          href: "/dealzora/inventory/purchases",
        },
        {
          name: "حركات المخزون",
          icon: <FaExchangeAlt />,
          href: "/dealzora/inventory/movements",
        },
        {
          name: "المخازن",
          icon: <FaWarehouse />,
          href: "/dealzora/inventory/warehouses",
        },
      ],
    },
  ];

  const toggleMenu = (name: string) => {
    setOpenMenu((prev) => (prev === name ? null : name));
  };

  return (
    <nav className="flex-1 flex flex-col gap-1 p-3 text-sm text-right select-none">
      {menu.map((item) => {
        const isActive = path === item.href;
        const isOpen = openMenu === item.name;

        const Button = (
          <button
            onClick={() => (item.submenu ? toggleMenu(item.name) : onClick?.())}
            className={`flex items-center w-full gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive
                ? "bg-blue-500 text-white"
                : "text-gray-300 hover:bg-blue-500"
            } ${!hovered && "justify-center"}`}
          >
            <span className="text-lg">{item.icon}</span>
            {hovered && (
              <div className="flex-1 flex justify-between items-center">
                <span>{item.name}</span>
                {item.submenu && (
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <FaChevronDown size={10} />
                  </motion.div>
                )}
              </div>
            )}
          </button>
        );

        // 🔹 زر رئيسي بدون قائمة فرعية
        if (!item.submenu) {
          return (
            <Link key={item.name} href={item.href!} onClick={onClick}>
              {Button}
            </Link>
          );
        }

        // 🔹 زر مع قائمة فرعية
        return (
          <div key={item.name}>
            {Button}

            <AnimatePresence initial={false}>
              {isOpen && hovered && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-1 px-2 py-2 border-b border-b-blue-400 rounded-md"
                >
                  {item.submenu.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href!}
                      onClick={onClick}
                      className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                        path === sub.href
                          ? "bg-blue-500 text-white"
                          : "text-gray-300 hover:bg-blue-500"
                      }`}
                    >
                      <span className="text-base">{sub.icon}</span>
                      <span>{sub.name}</span>
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
