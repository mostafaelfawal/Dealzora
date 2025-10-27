"use client";
import Image from "next/image";
import { FaEdit, FaTrash } from "react-icons/fa";
import Modal from "@/components/Modal";
import { ProductType } from "../../types/ProductType";
import ProductStatusBadge from "./ProductStatusBadge";

interface Props {
  product: ProductType;
  closeModal: () => void;
  openDeleteModal: () => void;
}

export default function ProductModal({
  product,
  closeModal,
  openDeleteModal,
}: Props) {
  return (
    <Modal title="تفاصيل المنتج" closeModal={closeModal}>
      <form className="bg-white rounded-2xl p-5 w-full max-w-sm mx-auto">
        <div className="flex flex-col items-center mb-4">
          <div className="relative w-24 h-24 rounded-xl overflow-hidden mb-3 shadow">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover"
            />
          </div>
          <p className="text-lg font-semibold text-gray-800">{product.name}</p>
          <p className="text-xs text-gray-400">كود: {product.code}</p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">السعر:</span>
            <span>{product.price} ج.م</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">الفئة:</span>
            <span>{product.category}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-gray-600">المخزون:</span>
            <span>{product.stock}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-600">الحالة:</span>
            <ProductStatusBadge
              stockAlert={product.stockAlert}
              stock={product.stock}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-5">
          <button
            type="button"
            className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2"
          >
            <FaEdit /> تعديل
          </button>
          <button
            type="button"
            onClick={openDeleteModal}
            className="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center gap-2"
          >
            <FaTrash /> حذف
          </button>
        </div>
      </form>
    </Modal>
  );
}
