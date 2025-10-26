export default function ProductFormButtons({
  loading,
  onDraft,
}: {
  loading: boolean;
  onDraft: VoidFunction;
}) {
  return (
    <div className="flex gap-3 pt-3">
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50"
      >
        {loading ? "جارٍ الحفظ..." : "إضافة المنتج"}
      </button>
      <button
        onClick={onDraft}
        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition"
      >
        حفظ كمسوده
      </button>
    </div>
  );
}
