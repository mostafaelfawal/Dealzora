"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { RxHamburgerMenu } from "react-icons/rx";
import UserInfo from "./UserInfo";
import MenuLinks from "./MenuLinks";
import Modal from "../Modal";
import toast from "react-hot-toast";
import useLogout from "@/features/auth/hooks/useLogout";
import { useRouter } from "next/navigation";

export default function SideMenu() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { logout, error, loading } = useLogout();
  const router = useRouter();
  const [openModal, setOpenModal] = useState<boolean>(false);

  const handleLogout = async () => {
    const success = await logout();
    if (success) router.replace("/auth");
    else toast.error(error);
  };

  return (
    <>
      {/* زر الموبايل */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 right-4 z-3 flex justify-center items-center w-10 h-10 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition md:hidden"
      >
        <RxHamburgerMenu className="size-5" />
      </button>

      {/* الموبايل */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-2 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="overflow-auto fixed top-0 right-0 h-full w-72 bg-blue-600 text-white shadow-2xl z-3 flex flex-col justify-between md:hidden"
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
              <UserInfo
                hovered={true}
                loading={loading}
                openModal={() => setOpenModal(true)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* الكمبيوتر */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`z-3 overflow-auto hidden md:flex fixed top-0 right-0 h-full bg-blue-600 text-white flex-col justify-between shadow-xl transition-all duration-300 ${
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
        <UserInfo
          hovered={hovered}
          loading={loading}
          openModal={() => setOpenModal(true)}
        />
      </div>
      {openModal && (
        <Modal
          closeModal={() => setOpenModal(false)}
          title="تأكيد تسجيل الخروج"
        >
          <div className="space-y-4 text-center">
            <p className="text-gray-600 text-sm">
              هل أنت متأكد أنك تريد تسجيل الخروج من حسابك؟
            </p>

            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => {
                  handleLogout();
                  setOpenModal(false);
                }}
                className="px-5 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                تسجيل الخروج
              </button>
              <button
                onClick={() => setOpenModal(false)}
                className="px-5 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all duration-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
