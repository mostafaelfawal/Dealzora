import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { ProductPaginationProps } from "../../types/ProductPaginationProps";

export default function ProductPagination({
  currentPage,
  totalPages,
  totalProducts,
  indexOfFirst,
  indexOfLast,
  handlePageChange,
}: ProductPaginationProps) {
  // حساب النطاق لعرض الصفحات فقط حول الصفحة الحالية
  const visiblePages = 5;
  const startPage = Math.max(1, currentPage - Math.floor(visiblePages / 2));
  const endPage = Math.min(totalPages, startPage + visiblePages - 1);

  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <tr>
      <td
        colSpan={6}
        className="py-4 px-4 flex flex-col sm:flex-row justify-between items-center gap-2"
      >
        <p className="text-gray-500 text-sm min-w-fit">
          عرض من {indexOfFirst + 1} إلى{" "}
          {indexOfLast > totalProducts ? totalProducts : indexOfLast} من{" "}
          {totalProducts} منتج
        </p>

        <div className="flex items-center gap-2">
          {/* زر السابق */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 text-gray-500 hover:text-blue-500 disabled:opacity-50 rounded transition-colors"
          >
            <FaArrowRight />
          </button>

          {/* أول صفحة */}
          {startPage > 1 && (
            <>
              <button
                onClick={() => handlePageChange(1)}
                className={`px-3 py-1 rounded ${
                  currentPage === 1
                    ? "bg-blue-500 text-white"
                    : "border border-gray-300 hover:bg-blue-50"
                }`}
              >
                1
              </button>
              {startPage > 2 && <span className="text-gray-400">...</span>}
            </>
          )}

          {/* الصفحات الظاهرة */}
          {pages.map((num) => (
            <button
              key={num}
              onClick={() => handlePageChange(num)}
              className={`px-3 py-1 rounded transition-colors ${
                currentPage === num
                  ? "bg-blue-500 text-white"
                  : "border border-gray-300 hover:bg-blue-50"
              }`}
            >
              {num}
            </button>
          ))}

          {/* آخر صفحة */}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && (
                <span className="text-gray-400">...</span>
              )}
              <button
                onClick={() => handlePageChange(totalPages)}
                className={`px-3 py-1 rounded ${
                  currentPage === totalPages
                    ? "bg-blue-500 text-white"
                    : "border border-gray-300 hover:bg-blue-50"
                }`}
              >
                {totalPages}
              </button>
            </>
          )}

          {/* زر التالي */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 text-gray-500 hover:text-blue-500 disabled:opacity-50 rounded transition-colors"
          >
            <FaArrowLeft />
          </button>
        </div>
      </td>
    </tr>
  );
}
