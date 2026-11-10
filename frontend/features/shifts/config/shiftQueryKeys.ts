export const shiftKeys = {
  all: ["shifts"] as const,
  current: () => [...shiftKeys.all, "current"] as const,
  list: (page: number, pageSize: number) =>
    [...shiftKeys.all, "list", page, pageSize] as const,
};
