import { LoginScreen } from "@/features/auth/components/loginScreen";
import LoginFormContextProvider from "@/features/auth/context/LoginFormContext";

export default function LoginPage() {
  return (
    <LoginFormContextProvider>
      <LoginScreen />
    </LoginFormContextProvider>
  );
}
