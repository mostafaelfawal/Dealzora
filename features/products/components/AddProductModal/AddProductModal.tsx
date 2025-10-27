"use client";

import Modal from "@/components/Modal";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import useAddProduct from "../../hooks/CRUD/useAddProduct";
import ProductImageUploader from "./ProductImageUploader";
import ProductInput from "./ProductInput";
import ProductNumberInput from "./ProductNumberInput";
import ProductFormButtons from "./ProductFormButtons";
import { useForm } from "react-hook-form";
import {
  addProductSchema,
  productSchemaType,
} from "../../schemas/addProductSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProductImage } from "../../hooks/useProductImage";

export default function AddProductModal({
  closeModal,
}: {
  closeModal: VoidFunction;
}) {
  const { addProduct, error } = useAddProduct();

  const {
    previewImage,
    file,
    isDragging,
    handleUploadImgBB,
    handleImageChange,
    handleDeleteImage,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useProductImage();

  const addProductHandler = async (data: productSchemaType) => {
    // ارفع الصورة أولاً
    closeModal();
    const imageURL = await handleUploadImgBB(file);

    toast.promise(
      addProduct({ ...data, image: imageURL ?? "/default_product.png" }),
      {
        loading: "جاري اضافة المنتج...",
        success: "تم اضافة المنتج بنجاح",
        error: error || "حدث خطأ أثناء اضافة المنتج",
      }
    );
  };

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(addProductSchema),
  });

  return (
    <Modal closeModal={closeModal} title="إضافة منتج جديد">
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onSubmit={handleSubmit(addProductHandler)}
        className="space-y-4"
      >
        <ProductImageUploader
          previewImage={previewImage}
          isDragging={isDragging}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          handleDeleteImage={handleDeleteImage}
          handleImageChange={handleImageChange}
        />

        <ProductInput
          label="اسم المنتج"
          errors={errors}
          register={register("name")}
          required
        />

        <ProductInput
          label="الكود"
          errors={errors}
          register={register("code")}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <ProductNumberInput
            label="السعر"
            register={register("price")}
            errors={errors}
            required
          />
          <ProductInput
            label="الفئة"
            register={register("category")}
            errors={errors}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ProductNumberInput
            label="الكمية في المخزون"
            register={register("stock")}
            errors={errors}
          />
          <ProductNumberInput
            label="حد التنبيه"
            register={register("stockAlert")}
            errors={errors}
          />
        </div>

        <ProductFormButtons
          onDraft={() => toast.success("تم حفظ المسودة (قريبًا)")}
        />
      </motion.form>
    </Modal>
  );
}
