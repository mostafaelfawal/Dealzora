import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { ProductPaginationProps } from "../../types/ProductPaginationProps";
import Tooltip from "@/components/Tooltip";
import { motion } from "framer-motion";

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
  if (totalProducts === 0) return <></>;

  return (
    <div className="py-4 px-4 flex flex-col md:flex-row justify-between items-center gap-2">
      <motion.p
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-gray-500 text-sm min-w-fit"
      >
        عرض من {indexOfFirst + 1} إلى{" "}
        {indexOfLast > totalProducts ? totalProducts : indexOfLast} من{" "}
        {totalProducts} منتج
      </motion.p>

      <div className="flex items-center gap-1">
        {/* زر السابق */}
        <Tooltip message="الصفحة السابقة" side="bottom">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 text-gray-500 hover:text-blue-500 disabled:opacity-50 rounded transition-colors"
          >
            <FaArrowRight />
          </motion.button>
        </Tooltip>

        {/* أول صفحة */}
        {startPage > 1 && (
          <>
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => handlePageChange(1)}
              className={`px-3 py-1 rounded text-sm ${
                currentPage === 1
                  ? "bg-blue-500 text-white"
                  : "border border-gray-300 hover:bg-blue-50"
              }`}
            >
              1
            </motion.button>
            {startPage > 2 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-400 px-1"
              >
                ...
              </motion.span>
            )}
          </>
        )}

        {/* الصفحات الظاهرة */}
        {pages.map((num) => (
          <motion.button
            key={num}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => handlePageChange(num)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              currentPage === num
                ? "bg-blue-500 text-white shadow-sm"
                : "border border-gray-300 hover:bg-blue-50"
            }`}
          >
            {num}
          </motion.button>
        ))}

        {/* آخر صفحة */}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-400 px-1"
              >
                ...
              </motion.span>
            )}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => handlePageChange(totalPages)}
              className={`px-3 py-1 rounded text-sm ${
                currentPage === totalPages
                  ? "bg-blue-500 text-white"
                  : "border border-gray-300 hover:bg-blue-50"
              }`}
            >
              {totalPages}
            </motion.button>
          </>
        )}

        {/* زر التالي */}
        <Tooltip message="الصفحة التالية" side="bottom">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 text-gray-500 hover:text-blue-500 disabled:opacity-50 rounded transition-colors"
          >
            <FaArrowLeft />
          </motion.button>
        </Tooltip>
      </div>
    </div>
  );
}
