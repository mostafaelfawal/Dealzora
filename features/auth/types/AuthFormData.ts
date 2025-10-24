import { LoginSchema } from "../schemas/loginSchema";
import { SigninSchema } from "../schemas/signinSchema";

export type AuthFormData =
  | (SigninSchema & { remember?: never })
  | (LoginSchema & {
      firstName?: never;
      lastName?: never;
      confirmPassword?: never;
    });
