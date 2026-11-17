import { PageEnter } from "@/components/shared/PageEnter";
import SetupFormContextProvider from "@/features/setup/context/SetupFormContext";
import { SetupScreen } from "@/features/setup/components/setupScreen";

export default function SetupPage() {
  return (
    <SetupFormContextProvider>
      <PageEnter>
        <SetupScreen />
      </PageEnter>
    </SetupFormContextProvider>
  );
}
