export const saleKeys = {
  all: ["sales"] as const,
  list: (f: object) => [...saleKeys.all, "list", f] as const,
  detail: (id: string) => [...saleKeys.all, "detail", id] as const,
  summary: () => [...saleKeys.all, "summary"] as const,
  returns: (f: object) => [...saleKeys.all, "returns", f] as const,
};

/** بعد أي بيع/مرتجع: كل ما يتأثر (المخزون، العملاء، الخزنة، الوردية، اللوحة). */
export const SALE_AFFECTED_KEYS = [
  saleKeys.all,
  ["products"],
  ["customers"],
  ["treasury"],
  ["shifts"],
  ["dashboard"],
  ["reports"],
  ["pos", "catalog"],
] as const;
