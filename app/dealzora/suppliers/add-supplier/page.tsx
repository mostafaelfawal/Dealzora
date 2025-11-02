"use client";

import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { FaUserPlus, FaUser, FaRegAddressCard } from "react-icons/fa";
import {
  FiPhone,
  FiMail,
  FiMapPin,
  FiHome,
  FiCheckCircle,
} from "react-icons/fi";
import { useRouter } from "next/navigation";
import InputField from "@/features/suppliers/add-supplier/components/InputField";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  supplierSchema,
  supplierSchemaType,
} from "@/features/suppliers/add-supplier/schemas/supplierSchema";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store/store";
import { addSupplier } from "@/features/suppliers/add-supplier/slices/addSupplier";
import { useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function AddSupplierPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [loading, setLoading] = useState<boolean>(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(supplierSchema) });

  const onSubmit = async (data: supplierSchemaType) => {
    setLoading(true);
    try {
      await dispatch(addSupplier(data)).unwrap();
      router.back();
      toast.success("تم إضافة المورد بنجاح");
    } catch (error: any) {
      toast.error(error || "حدث خطأ أثناء إضافة المورد");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-5xl"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto shadow-md">
            <FaUserPlus className="text-white text-3xl" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mt-4 mb-1">
            إضافة مورد جديد
          </h1>
          <p className="text-gray-500 text-sm">
            قم بإدخال بيانات المورد المطلوبة بدقة
          </p>
        </div>

        {/* Main Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl shadow-lg p-6 md:p-10 grid gap-8"
        >
          {/* قسم البيانات الأساسية */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <FiCheckCircle className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">
                البيانات الأساسية
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField
                label="اسم المورد"
                icon={<FaUser />}
                required
                register={register("name")}
                error={errors.name?.message}
              />
              <InputField
                label="اسم الشركة"
                icon={<FaRegAddressCard />}
                register={register("companyName")}
              />
            </div>
          </section>

          {/* قسم التواصل */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <FiPhone className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">التواصل</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField
                label="رقم الهاتف"
                icon={<FiPhone />}
                required
                register={register("phoneNumber")}
                error={errors.phoneNumber?.message}
              />
              <InputField
                label="رقم بديل"
                icon={<FiPhone />}
                register={register("altPhoneNumber")}
              />
              <InputField
                label="البريد الإلكتروني"
                icon={<FiMail />}
                register={register("email")}
              />
            </div>
          </section>

          {/* قسم الموقع */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <FiMapPin className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">الموقع</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputField
                label="المدينة"
                icon={<FiMapPin />}
                register={register("city")}
              />
              <InputField
                label="العنوان"
                icon={<FiHome />}
                register={register("address")}
              />
            </div>
          </section>

          {/* قسم الملاحظات */}
          <section>
            <label className="block mb-2 text-gray-700">ملاحظات</label>
            <textarea
              {...register("notes")}
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 duration-300 transition-shadow focus:outline-none"
              placeholder="اكتب ملاحظات عن المورد..."
            ></textarea>
          </section>

          {/* أزرار التحكم */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
            >
              إلغاء
            </button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-800"
            >
              حفظ المورد
              {loading && <LoadingSpinner />}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
