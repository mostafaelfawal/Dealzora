import { BRAND } from "@/config/brand";

import {
  SHOWCASE_FEATURES,
  SHOWCASE_SUBTITLE,
  SHOWCASE_TAGLINE,
} from "../config/setupShowcase";
import Image from "next/image";

export function SetupShowcase() {
  return (
    <aside
      aria-label={`عن ${BRAND.name}`}
      className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-primary p-12 text-primary-foreground lg:flex"
    >
      {/* زخرفة خفيفة */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-primary-foreground/5"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 size-96 rounded-full bg-primary-foreground/5"
      />

      <header className="relative flex items-center gap-3">
        <Image
          src={"/logo/logo.png"}
          alt={BRAND.name}
          width={50}
          height={BRAND.logo.icon.height}
          priority
          className="rounded-sm "
        />
        <span className="text-2xl font-bold tracking-tight">{BRAND.name}</span>
      </header>

      <div className="relative space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold leading-tight">
            {SHOWCASE_TAGLINE}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-primary-foreground/80">
            {SHOWCASE_SUBTITLE}
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-3">
          {SHOWCASE_FEATURES.map(({ title, description, icon: Icon }) => (
            <li
              key={title}
              className="space-y-1.5 border border-primary-foreground/15 bg-primary-foreground/5 p-3"
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4 shrink-0" aria-hidden />
                <h3 className="text-sm font-semibold">{title}</h3>
              </div>
              <p className="text-xs leading-relaxed text-primary-foreground/70">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <footer className="relative text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} {BRAND.name}. جميع الحقوق محفوظة.
      </footer>
    </aside>
  );
}
