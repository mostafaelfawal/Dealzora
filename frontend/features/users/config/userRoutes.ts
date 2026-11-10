export const USER_ROUTES = {
  list: "/admin/users",
  new: "/admin/users/new",
  edit: (id: string) => `/admin/users/edit?user_id=${id}`,
} as const;
