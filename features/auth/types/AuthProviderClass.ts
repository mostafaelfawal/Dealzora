import { GithubAuthProvider, GoogleAuthProvider } from "firebase/auth";

export type AuthProviderClass =
  | typeof GoogleAuthProvider
  | typeof GithubAuthProvider;
