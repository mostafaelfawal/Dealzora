export const customerKeys = {
  all: ["customers"] as const,
  list: () => [...customerKeys.all, "list"] as const,
  statement: (id: string) => [...customerKeys.all, "statement", id] as const,
};
