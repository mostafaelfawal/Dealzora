export const PRODUCT_ROUTES = {
  list: "/admin/products",
  new: "/admin/products/new",
  edit: (id: string) => `/admin/products/edit?product_id=${id}`,
} as const;
