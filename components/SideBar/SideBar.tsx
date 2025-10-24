"use client";

import { RootState } from "@/store/store";
import Image from "next/image";
import { FiSidebar } from "react-icons/fi";
import { MdAddShoppingCart } from "react-icons/md";
import { RxHamburgerMenu } from "react-icons/rx";
import { useSelector } from "react-redux";

export default function SideBar() {
  const user = useSelector((state: RootState) => state.user.currentUser);
  // user?.avatar ?? "/default_avatar.png"
  // user?.name
  // user?.email
  return (
    <div className="flex gap-2 absolute top-0 right-0">
      <div
        onClick={() => (location.href = "/dashboard")}
        className="sm:block hidden relative size-10 cursor-pointer"
      >
        <Image
          src="/og-image.png"
          alt="Logo"
          fill
          priority
          className="object-cover"
        />
      </div>
      <div className="sm:flex hidden gap-2 p-1 rounded-full border border-gray-300 bg-white h-fit shadow-xl">
        <button className="flex items-center justify-center rounded-full w-7 h-7 hover:bg-gray-100">
          <FiSidebar />
        </button>
        <button className="flex items-center justify-center rounded-full w-7 h-7 hover:bg-gray-100">
          <MdAddShoppingCart />
        </button>
      </div>
      <button className="sm:hidden flex justify-center items-center w-7 h-7 rounded-full hover:bg-gray-100">
        <RxHamburgerMenu />
      </button>
    </div>
  );
}
