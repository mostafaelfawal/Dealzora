"use client";
import Image from "next/image";
import { FaEdit, FaTrash } from "react-icons/fa";
import { RxDotsVertical } from "react-icons/rx";
import { ProductType } from "../../types/ProductType";
import ProductStatusBadge from "./ProductStatusBadge";
import ProductModal from "./ProductModal";
import useDeleteProduct from "../../hooks/CRUD/useDeleteProduct";
import toast from "react-hot-toast";

interface Props {
  product: ProductType;
  openRow: string | null;
  setOpenRow: (code: string | null) => void;
}

export default function ProductRow({ product, openRow, setOpenRow }: Props) {
  const { deleteProduct, error } = useDeleteProduct();

  const handleDeleteProduct = async () => {
    toast.promise(deleteProduct(product.id!), {
      loading: "جاري حذف المنتج...",
      success: "تم حذف المنتج بنجاح",
      error: error || "حدث خطأ أثناء حذف المنتج",
    });
  };
  return (
    <tr className="hover:bg-blue-50 transition-colors border-b border-gray-200">
      <td className="flex gap-3 py-3 px-4 items-center relative">
        <button
          onClick={() =>
            setOpenRow(openRow === product.code ? null : product.code)
          }
          className="block md:hidden text-gray-600 hover:text-blue-500 transition"
        >
          <RxDotsVertical size={20} />
        </button>

        <div className="relative w-12 h-12 rounded-lg overflow-hidden">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
          />
        </div>
        <div>
          <p className="font-semibold">{product.name}</p>
          <p className="text-xs text-gray-400">كود: {product.code}</p>
        </div>

        {openRow === product.code && (
          <ProductModal product={product} closeModal={() => setOpenRow(null)} />
        )}
      </td>

      <td className="hidden md:table-cell py-3 px-4">{product.price} ج.م</td>
      <td className="hidden md:table-cell py-3 px-4">{product.category}</td>
      <td className="hidden md:table-cell py-3 px-4">{product.stock ?? "—"}</td>
      <td className="hidden md:table-cell py-3 px-4">
        <ProductStatusBadge
          stockAlert={product.stockAlert}
          stock={product.stock}
        />
      </td>

      <td className="hidden md:table-cell py-3 px-4">
        <div className="flex gap-2 flex-wrap">
          <button className="flex items-center gap-1 px-3 py-1 text-white bg-blue-500 rounded hover:bg-blue-600 transition">
            <FaEdit /> تعديل
          </button>
          <button
            onClick={handleDeleteProduct}
            className="flex items-center gap-1 px-3 py-1 text-white bg-red-500 rounded hover:bg-red-600 transition"
          >
            <FaTrash /> حذف
          </button>
        </div>
      </td>
    </tr>
  );
}
