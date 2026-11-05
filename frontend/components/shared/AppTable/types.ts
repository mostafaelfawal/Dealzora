import type { ComponentType, ReactNode } from "react";

export type TableIcon = ComponentType<{ className?: string }>;

export interface AppTableColumn<T> {
  id: string;
  /** عنوان العمود. مرّر <span className="sr-only"> للأعمدة بدون عنوان. */
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  /** يُطبَّق على th و td معاً (للعرض المتجاوب والعرض: "hidden md:table-cell w-48"). */
  className?: string;
  /** يُطبَّق على td فقط. */
  cellClassName?: string;
  /** شكل الـ skeleton أثناء التحميل. */
  skeletonClassName?: string;
}

export interface AppTableEmptyState {
  icon: TableIcon;
  title: string;
  description?: string;
  /** زر أو أكثر (إضافة، استيراد…). */
  action?: ReactNode;
}

export interface AppTableNoResults {
  icon?: TableIcon;
  title?: string;
  description?: string;
}

export interface AppTablePaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizes?: number[];
  /** "الأصناف" / "العملاء" */
  itemsLabel?: string;
}

export interface AppTableBulkActions<T> {
  /** وجودها يُظهر زر الحذف. clear تلغي التحديد بعد النجاح. */
  onDelete?: (rows: T[], clear: () => void) => void;
  /** وجودها يُظهر زر التعطيل. */
  onDeactivate?: (rows: T[], clear: () => void) => void;
  /** true = تظهر نافذة تأكيد قبل الحذف (الافتراضي). */
  confirmDelete?: boolean;
  /** يعطّل الأزرار أثناء تنفيذ العملية. */
  isPending?: boolean;
  /** "صنف" / "عميل" للنص داخل نافذة التأكيد. */
  itemLabel?: string;
}
