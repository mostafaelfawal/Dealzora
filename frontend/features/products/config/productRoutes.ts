export const PRODUCT_ROUTES = {
  list: "/main/products",
  new: "/main/products/new",
  edit: (id: string) => `/main/products/edit?product_id=${id}`,
} as const;
