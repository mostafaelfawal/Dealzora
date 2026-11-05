import SetupFormContextProvider from "@/features/setup/context/SetupFormContext";
import { SetupScreen } from "@/features/setup/components/setupScreen";

export default function SetupPage() {
  return (
    <SetupFormContextProvider>
      <SetupScreen />
    </SetupFormContextProvider>
  );
}
