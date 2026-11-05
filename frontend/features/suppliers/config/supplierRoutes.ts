export const SUPPLIER_ROUTES = {
  list: "/admin/suppliers",
  new: "/admin/suppliers/new",
  edit: (id: string) => `/admin/suppliers/edit?supplier_id=${id}`,
  statement: (id: string) => `/admin/suppliers/statement?supplier_id=${id}`,
} as const;
