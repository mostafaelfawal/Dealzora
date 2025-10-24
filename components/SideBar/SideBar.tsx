"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { RxHamburgerMenu } from "react-icons/rx";
import UserInfo from "./UserInfo";
import MenuLinks from "./MenuLinks";

export default function SideMenu() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <>
      {/* زر الموبايل */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 right-4 z-50 flex justify-center items-center w-10 h-10 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition md:hidden"
      >
        <RxHamburgerMenu className="size-5" />
      </button>

      {/* الموبايل */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed top-0 right-0 h-full w-72 bg-blue-600 text-white shadow-2xl z-50 flex flex-col justify-between md:hidden"
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            >
              <div className="flex items-center gap-3 p-5 border-b border-blue-500">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden">
                  <Image
                    src="/icon.png"
                    alt="Logo"
                    fill
                    priority
                    className="object-cover"
                  />
                </div>
                <h1 className="text-lg font-semibold">Dealzora</h1>
              </div>
              <MenuLinks hovered={true} onClick={() => setOpen(false)} />
              <UserInfo hovered={true} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* الكمبيوتر */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`hidden md:flex fixed top-0 right-0 h-full bg-blue-600 text-white flex-col justify-between shadow-xl transition-all duration-300 ${
          hovered ? "w-64" : "w-20"
        }`}
      >
        <div className="flex items-center gap-3 p-5 border-b border-blue-500">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden">
            <Image
              src="/icon.png"
              alt="Logo"
              fill
              priority
              className="object-cover"
            />
          </div>
          {hovered && <h1 className="text-lg font-semibold">Dealzora</h1>}
        </div>
        <MenuLinks hovered={hovered} />
        <UserInfo hovered={hovered} />
      </div>
    </>
  );
}
