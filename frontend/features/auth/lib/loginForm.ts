import type { LoginSchemaType } from "../schema/login.schema";

export const emptyLoginValues = (): LoginSchemaType => ({
  role: "cashier",
  username: "",
  password: "",
});
