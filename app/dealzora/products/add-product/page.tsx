"use client";

import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useFetchCategories from "@/features/products/hooks/useFetchCategories";
import { useProductImage } from "@/features/products/hooks/useProductImage";
import {
  addProductSchema,
  productSchemaType,
} from "@/features/products/add-product/schemas/addProductSchema";
import ProductImageUploader from "@/features/products/components/AddProductModal/ProductImageUploader";
import ProductInput from "@/features/products/components/AddProductModal/ProductInput";
import ProductFormButtons from "@/features/products/components/AddProductModal/ProductFormButtons";
import {
  FiPackage,
  FiDollarSign,
  FiHash,
  FiAlertCircle,
  FiInfo,
  FiBox,
} from "react-icons/fi";
import { BiCategory } from "react-icons/bi";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { FaUser } from "react-icons/fa";
import { useEffect, useState } from "react";
import ProductStatusBadge from "@/features/products/components/Product/ProductStatusBadge";
import { startListeningToSuppliers } from "@/features/suppliers/slices/supplierListener";
import InputField from "@/features/suppliers/add-supplier/components/InputField";
import { addProduct } from "@/features/products/add-product/slices/addProduct";

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const { categories } = useFetchCategories();
  const dispatch = useDispatch<AppDispatch>();
  const suppliers = useSelector(
    (state: RootState) => state.suppliers.suppliers
  );

  useEffect(() => {
    startListeningToSuppliers(dispatch);
  }, [dispatch]);

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

  const handleSaveProduct = async (data: productSchemaType) => {
    setLoading(true);
    const imageURL = await handleUploadImgBB(file);
    const finalData = { ...data, image: imageURL ?? "/default_product" };
    try {
      await dispatch(addProduct(finalData)).unwrap();
      router.back();
      toast.success("تم إضافة المورد بنجاح");
    } catch (error: any) {
      toast.error(error || "حدث خطأ أثناء إضافة المورد");
    } finally {
      setLoading(false);
    }
  };

  const {
    handleSubmit,
    register,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(addProductSchema),
  });
  // لتتبع حالة المخزون بمجرد تغيير المخزون
  const stock = watch("stock");
  const stockAlert = watch("stockAlert");

  return (
    <div>
      <div className="container mx-auto px-4 max-w-2xl">
        {/* رأس الصفحة */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="w-20 h-20  bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <FiPackage className="text-3xl text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-3">
            إضافة منتج جديد
          </h1>
          <p className="text-gray-600 text-lg">
            أضف منتج جديد إلى متجرك واملأ المعلومات المطلوبة بدقة
          </p>
        </motion.div>

        {/* نموذج المنتج */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
        >
          <form onSubmit={handleSubmit(handleSaveProduct)}>
            {/* صورة المنتج */}
            <div className="p-6 bg-linear-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
              <div className="flex items-center gap-3 mb-4 justify-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FiBox className="text-blue-600 text-xl" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">
                  صورة المنتج
                </h3>
              </div>
              <p className="text-gray-600 text-sm text-center mb-6">
                قم برفع صورة واضحة للمنتج
              </p>

              <ProductImageUploader
                previewImage={previewImage}
                isDragging={isDragging}
                handleDragOver={handleDragOver}
                handleDragLeave={handleDragLeave}
                handleDrop={handleDrop}
                handleDeleteImage={handleDeleteImage}
                handleImageChange={handleImageChange}
              />

              {previewImage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200 flex items-center justify-center gap-2"
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-green-700 text-sm text-center">
                    ✓ تم تحميل الصورة بنجاح
                  </p>
                </motion.div>
              )}
            </div>

            {/* المعلومات الأساسية */}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FiInfo className="text-blue-600 text-xl" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">
                  المعلومات الأساسية
                </h3>
              </div>

              <div className="space-y-4">
                <InputField
                  label="اسم المنتج"
                  error={errors.name?.message}
                  register={register("name")}
                  required
                  icon={<FiPackage className="text-gray-400" />}
                />

                <InputField
                  label="الكود"
                  error={errors.code?.message}
                  register={register("code")}
                  required
                  icon={<FiHash />}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="السعر"
                    register={register("price")}
                    error={errors.price?.message}
                    required
                    icon={<FiDollarSign />}
                  />

                  <ProductInput
                    label="الفئة"
                    register={register("categories")}
                    errors={errors}
                    type="category"
                    required
                    categories={categories}
                    icon={<BiCategory />}
                  />
                </div>
              </div>
            </div>

            {/* إدارة المخزون */}
            <div className="p-6 bg-linear-to-r from-green-50 to-emerald-50 border-t border-green-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FiAlertCircle className="text-green-600 text-xl" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">
                  إدارة المخزون
                </h3>
              </div>

              <div className="space-y-4">
                <InputField
                  label="الكمية في المخزون"
                  register={register("stock")}
                  error={errors.stock?.message}
                  icon={<FiBox />}
                />

                <InputField
                  label="حد التنبيه"
                  register={register("stockAlert")}
                  error={errors.stockAlert?.message}
                  icon={<FiAlertCircle />}
                />
                <ProductInput
                  label="اختر مورد"
                  suppliers={suppliers}
                  type="suppliers"
                  register={register("supplier")}
                  errors={errors}
                  icon={<FaUser className="text-gray-400" />}
                />
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-3"
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <p className="flex items-center gap-2 text-blue-700 text-sm">
                  <FiInfo /> سيتم ارسال لك اشعار عند انخفاض او انتهاء المخزون
                </p>
                <div className="flex flex-col gap-2 bg-blue-100 p-2 rounded">
                  حالة المخزون
                  <ProductStatusBadge
                    stock={Number(stock)}
                    stockAlert={Number(stockAlert)}
                  />
                </div>
              </motion.div>
            </div>

            {/* الأزرار */}
            <div className="border-t border-gray-200 bg-gray-50 p-6">
              <ProductFormButtons
                loading={loading}
                onDraft={() => toast.success("تم حفظ المسودة (قريبًا)")}
              />
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
