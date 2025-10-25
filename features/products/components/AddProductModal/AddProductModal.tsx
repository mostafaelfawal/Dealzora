"use client";

import Modal from "@/components/Modal";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useEffect, useState } from "react";
import useAddProduct from "../../hooks/CRUD/useAddProduct";
import { ProductType } from "../../types/ProductType";
import ProductImageUploader from "./ProductImageUploader";
import ProductInput from "./ProductInput";
import ProductNumberInput from "./ProductNumberInput";
import ProductFormButtons from "./ProductFormButtons";

export default function AddProductModal({
  closeModal,
}: {
  closeModal: VoidFunction;
}) {
  const { addProduct, loading, error } = useAddProduct();

  const [product, setProduct] = useState<ProductType>({
    image: "",
    name: "",
    code: "",
    price: 0,
    category: "",
    stock: 0,
    stockAlert: 0,
  });

  useEffect(() => {
    if (error) {
      toast.dismiss();
      toast.error(error);
    }
  }, [error]);

  const addProductHandler = async () => {
    const success = await addProduct(product);
    if (success) {
      toast.success("تم إضافة المنتج بنجاح");
      closeModal();
    }
  };

  return (
    <Modal closeModal={closeModal} title="إضافة منتج جديد">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <ProductImageUploader
          image={product.image!}
          onImageChange={(url) => setProduct({ ...product, image: url })}
        />

        <ProductInput
          label="اسم المنتج"
          value={product.name}
          onChange={(v) => setProduct({ ...product, name: v })}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <ProductNumberInput
            label="السعر"
            value={product.price}
            onChange={(v) => setProduct({ ...product, price: v })}
            required
          />
          <ProductInput
            label="الفئة"
            value={product.category}
            onChange={(v) => setProduct({ ...product, category: v })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ProductNumberInput
            label="الكمية في المخزون"
            value={product.stock}
            onChange={(v) => setProduct({ ...product, stock: v })}
          />
          <ProductNumberInput
            label="حد التنبيه"
            value={product.stockAlert!}
            onChange={(v) => setProduct({ ...product, stockAlert: v })}
          />
        </div>

        <ProductFormButtons
          loading={loading}
          onSave={addProductHandler}
          onDraft={() => toast.success("تم حفظ المسودة (قريبًا)")}
        />
      </motion.div>
    </Modal>
  );
}
