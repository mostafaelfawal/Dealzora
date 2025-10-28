"use client";

import Modal from "@/components/Modal";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import useAddProduct from "../../hooks/CRUD/useAddProduct";
import ProductImageUploader from "./ProductImageUploader";
import ProductInput from "./ProductInput";
import ProductFormButtons from "./ProductFormButtons";
import { useForm } from "react-hook-form";
import {
  addProductSchema,
  productSchemaType,
} from "../../schemas/addProductSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProductImage } from "../../hooks/useProductImage";
import useUpdateProduct from "../../hooks/CRUD/useUpdateProduct";
import { ProductType } from "../../types/ProductType";
import useFetchCategories from "../../hooks/useFetchCategories";

export default function AddProductModal({
  closeModal,
  defaultValues,
  isEdit = false,
}: {
  closeModal: VoidFunction;
  defaultValues?: ProductType;
  isEdit?: boolean;
}) {
  const { addProduct, error } = useAddProduct();
  const { categories } = useFetchCategories();
  const { updateProduct, errorU } = useUpdateProduct();
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
  } = useProductImage(defaultValues?.image);

  const handleSaveProduct = async (data: productSchemaType) => {
    closeModal();

    const imageURL = await handleUploadImgBB(file);
    const finalData = { ...data, image: imageURL ?? "/default_product.png" };

    if (isEdit) {
      toast.promise(updateProduct(finalData, defaultValues?.id!), {
        loading: "جاري تحديث المنتج...",
        success: "تم تحديث المنتج بنجاح",
        error: errorU || "حدث خطأ أثناء تحديث المنتج",
      });
    } else {
      toast.promise(addProduct(finalData), {
        loading: "جاري اضافة المنتج...",
        success: "تم اضافة المنتج بنجاح",
        error: error || "حدث خطأ أثناء اضافة المنتج",
      });
    }
  };

  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(addProductSchema),
    defaultValues: defaultValues,
  });

  return (
    <Modal
      closeModal={closeModal}
      title={isEdit ? "تعديل المنتج" : "إضافة منتج جديد"}
    >
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onSubmit={handleSubmit(handleSaveProduct)}
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
          {/* حقل السعر - نوع number */}
          <ProductInput
            label="السعر"
            register={register("price")}
            errors={errors}
            type="number"
            required
          />

          {/* حقل الفئة - نوع category */}
          <ProductInput
            label="الفئة"
            register={register("categories")}
            errors={errors}
            type="category"
            required
            categories={categories}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* حقل الكمية - نوع number */}
          <ProductInput
            label="الكمية في المخزون"
            register={register("stock")}
            errors={errors}
            type="number"
          />

          {/* حقل حد التنبيه - نوع number */}
          <ProductInput
            label="حد التنبيه"
            register={register("stockAlert")}
            errors={errors}
            type="number"
          />
        </div>

        <ProductFormButtons
          isEdit={isEdit}
          onDraft={() => toast.success("تم حفظ المسودة (قريبًا)")}
        />
      </motion.form>
    </Modal>
  );
}
