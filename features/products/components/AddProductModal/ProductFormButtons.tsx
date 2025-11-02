import LoadingSpinner from "@/components/LoadingSpinner";
import { useRouter } from "next/navigation";

export default function ProductFormButtons({
  onDraft,
  isEdit = false,
  loading,
}: {
  onDraft: VoidFunction;
  isEdit?: boolean;
  loading: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex gap-3 px-8 mt-2 mb-2">
      <button
        type="button"
        onClick={() => router.back()}
        className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
      >
        إلغاء
      </button>

      <button
        type="button"
        onClick={onDraft}
        className="px-6 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
      >
        حفظ كمسودة
      </button>

      <button
        type="submit"
        disabled={loading}
        className="flex gap-2 items-center px-6 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50"
      >
        {isEdit ? "حفظ التغيرات" : "إضافة المنتج"}
        {loading && <LoadingSpinner />}
      </button>
    </div>
  );
}
