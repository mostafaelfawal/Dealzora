import { AppHeader } from "./header/AppHeader";
import { AppSidebar } from "./sidebar/AppSidebar";

/** الإطار العام: القائمة الجانبية + الـ Header + المحتوى. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
