import { AppHeader } from "./header/AppHeader";
import { NavHotkeys } from "./NavHotkeys";
import { AppSidebar } from "./sidebar/AppSidebar";

/** الإطار العام: القائمة الجانبية + الـ Header + المحتوى. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-dvh overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader />
        {/*
          relative: العناصر المطلقة داخل المحتوى (sr-only، checkbox المخفي، التلميحات)
          تتموضع بالنسبة لـ main فتُقص وتُمرَّر معه، بدل أن تمد طول الصفحة كلها
          وتُظهر شريط تمرير للنافذة يقص الـ sidebar.
        */}
        <main className="relative min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
      <NavHotkeys />
    </div>
  );
}
