export interface ProductPaginationProps {
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  indexOfFirst: number;
  indexOfLast: number;
  handlePageChange: (page: number) => void;
}
