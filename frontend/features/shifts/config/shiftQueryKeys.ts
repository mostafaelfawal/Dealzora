export const shiftKeys = {
  all: ["shifts"] as const,
  current: () => [...shiftKeys.all, "current"] as const,
  list: (page: number, pageSize: number) =>
    [...shiftKeys.all, "list", page, pageSize] as const,
};

/** عدد العملات الشائعة لعدّ الدرج بسرعة (جنيه). */
export const CASH_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1] as const;
