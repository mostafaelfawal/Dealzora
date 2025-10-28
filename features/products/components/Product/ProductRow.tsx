"use client";
import Image from "next/image";
import { FaEdit, FaTrash } from "react-icons/fa";
import { RxDotsVertical } from "react-icons/rx";
import { ProductType } from "../../types/ProductType";
import ProductStatusBadge from "./ProductStatusBadge";
import ProductModal from "./ProductModal";
import useDeleteProduct from "../../hooks/CRUD/useDeleteProduct";
import toast from "react-hot-toast";
import Modal from "@/components/Modal";
import { useState } from "react";
import { motion } from "framer-motion";
import AddProductModal from "../AddProductModal/AddProductModal";

interface Props {
  product: ProductType;
  openRow: string | null;
  setOpenRow: (code: string | null) => void;
}

export default function ProductRow({ product, openRow, setOpenRow }: Props) {
  const { deleteProduct, error } = useDeleteProduct();
  const [deleteModal, setDeleteModal] = useState(false);
  const [editModal, setEditModal] = useState(false);

  const handleDeleteProduct = async () => {
    setDeleteModal(false);
    toast.promise(deleteProduct(product.id!), {
      loading: "جاري حذف المنتج...",
      success: "تم حذف المنتج بنجاح",
      error: error || "حدث خطأ أثناء حذف المنتج",
    });
  };

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="border-b border-gray-200 hover:bg-gray-50"
      >
        {/* Product Info */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-3 relative">
            {/* Menu Button */}
            <button
              onClick={() =>
                setOpenRow(openRow === product.code ? null : product.code)
              }
              className="block md:hidden text-gray-500 hover:text-blue-500"
            >
              <RxDotsVertical size={18} />
            </button>

            {/* Product Image */}
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
              />
            </div>

            {/* Product Details */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{product.name}</p>
              <p className="text-xs text-gray-500">كود: {product.code}</p>
            </div>

            {/* Mobile Modal */}
            {openRow === product.code && (
              <ProductModal
                openDeleteModal={() => setDeleteModal(true)}
                openUpdateModal={() => setEditModal(true)}
                product={product}
                closeModal={() => setOpenRow(null)}
              />
            )}
          </div>
        </td>

        {/* Price */}
        <td className="hidden md:table-cell w-fit py-3 px-4">
          <span className="font-medium text-gray-700">{product.price} ج.م</span>
        </td>

        {/* Categories */}
        <td className="hidden md:table-cell py-3 px-4">
          <div className="flex flex-wrap gap-1">
            {product.categories.split(",").map((category, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
              >
                {category.trim()}
              </span>
            ))}
          </div>
        </td>

        {/* Stock */}
        <td className="hidden md:table-cell py-3 px-4">
          <span className="font-medium text-gray-700">{product.stock}</span>
        </td>

        {/* Status */}
        <td className="hidden md:table-cell py-3 px-4">
          <ProductStatusBadge
            stockAlert={product.stockAlert}
            stock={product.stock}
          />
        </td>

        {/* Actions */}
        <td className="hidden md:table-cell py-3 px-4">
          <div className="flex gap-2">
            <button
              onClick={() => setEditModal(true)}
              className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm"
            >
              <FaEdit size={14} />
              تعديل
            </button>
            <button
              onClick={() => setDeleteModal(true)}
              className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
            >
              <FaTrash size={14} />
              حذف
            </button>
          </div>
        </td>
      </motion.tr>

      {/* Delete Modal */}
      {deleteModal && (
        <Modal closeModal={() => setDeleteModal(false)} title="حذف المنتج">
          <div className="flex flex-col items-center text-center space-y-4">
            {/* Icon */}
            <div className="w-16 h-16 flex items-center justify-center rounded-full bg-red-100 text-red-500 mb-2">
              <FaTrash size={24} />
            </div>

            {/* Text */}
            <p className="text-gray-700">
              هل أنت متأكد أنك تريد حذف المنتج{" "}
              <span className="font-semibold">"{product.name}"</span>؟
            </p>

            {/* Actions */}
            <div className="flex gap-3 w-full mt-4">
              <button
                onClick={handleDeleteProduct}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                نعم، احذف
              </button>
              <button
                onClick={() => setDeleteModal(false)}
                className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editModal && (
        <AddProductModal
          isEdit={true}
          closeModal={() => setEditModal(false)}
          defaultValues={product}
        />
      )}
    </>
  );
}
