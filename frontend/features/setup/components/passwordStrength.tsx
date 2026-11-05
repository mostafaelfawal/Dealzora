import { cn } from "@/lib/utils";

import { passwordStrength } from "../lib/passwordStrength";

const BAR_COLOR = ["", "bg-destructive", "bg-warning", "bg-primary", "bg-success"] as const;

export function PasswordStrength({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;

  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("h-1 flex-1 bg-muted transition-colors", i <= score && BAR_COLOR[score])}
          />
        ))}
      </div>
      <span className="w-12 text-xs text-muted-foreground">{label}</span>
    </div>
  );
}