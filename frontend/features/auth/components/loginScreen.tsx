import { BrandLogo } from "@/components/shared/BrandLogo";
import { BRAND } from "@/config/brand";

import { ConnectLink } from "@/features/devices/components/connectLink";

import { LoginForm } from "./loginForm";

export function LoginScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="flex items-center gap-3">
        <BrandLogo variant="icon" className="h-10" />
        <span className="text-2xl font-bold tracking-tight">{BRAND.name}</span>
      </div>
      <div className="w-full max-w-sm space-y-4">
        <LoginForm />
        <ConnectLink />
      </div>
    </main>
  );
}
