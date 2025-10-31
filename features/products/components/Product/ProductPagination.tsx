import { Pagination } from "@mui/material";
import { ProductPaginationProps } from "../../types/ProductPaginationProps";
import { motion } from "framer-motion";

export default function ProductPagination({
  currentPage,
  totalPages,
  totalProducts,
  indexOfFirst,
  indexOfLast,
  handlePageChange,
}: ProductPaginationProps) {
  if (totalProducts === 0) return <></>;

  return (
    <div className="py-4 px-4 flex flex-col md:flex-row justify-between items-center gap-2">
      {/* نص عرض النتائج */}
      <motion.p
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-gray-500 text-sm min-w-fit"
      >
        عرض من {indexOfFirst + 1} إلى{" "}
        {indexOfLast > totalProducts ? totalProducts : indexOfLast} من{" "}
        {totalProducts} منتج
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Pagination
          dir="ltr"
          count={totalPages}
          page={currentPage}
          onChange={(_, page) => handlePageChange(page)}
          color="primary"
        />
      </motion.div>
    </div>
  );
}
