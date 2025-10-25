import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import Tooltip from "@/components/Tooltip";

interface Props {
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  indexOfFirst: number;
  indexOfLast: number;
  handlePageChange: (page: number) => void;
}

export default function ProductPagination({
  currentPage,
  totalPages,
  totalProducts,
  indexOfFirst,
  indexOfLast,
  handlePageChange,
}: Props) {
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
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 text-gray-500 hover:text-blue-500 disabled:opacity-50 rounded transition-colors"
          >
            <FaArrowRight />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <Tooltip key={num} side="bottom" message={`اذهب للصفحة ${num}`}>
              <button
                onClick={() => handlePageChange(num)}
                className={`px-3 py-1 rounded transition-colors ${
                  currentPage === num
                    ? "bg-blue-500 text-white"
                    : "border border-gray-300 hover:bg-blue-50"
                }`}
              >
                {num}
              </button>
            </Tooltip>
          ))}

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
