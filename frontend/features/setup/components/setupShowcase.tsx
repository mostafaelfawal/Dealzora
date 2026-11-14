import Image from "next/image";

import { BRAND } from "@/config/brand";

import {
  SHOWCASE_FEATURES,
  SHOWCASE_NEXT_STEPS,
  SHOWCASE_SUBTITLE,
  SHOWCASE_TAGLINE,
  SHOWCASE_TRUST,
} from "../config/setupShowcase";

export function SetupShowcase() {
  return (
    <aside
      aria-label={`عن ${BRAND.name}`}
      className="relative hidden flex-col gap-10 overflow-x-clip overflow-y-auto bg-primary p-10 text-primary-foreground lg:flex xl:p-14"
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
          src="/logo/logo.png"
          alt=""
          width={44}
          height={44}
          priority
          className="rounded-sm"
        />
        <span className="text-2xl font-bold tracking-tight">{BRAND.name}</span>
      </header>

      <div className="relative my-auto space-y-10">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold leading-tight xl:text-4xl">
            {SHOWCASE_TAGLINE}
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-primary-foreground/80">
            {SHOWCASE_SUBTITLE}
          </p>
        </div>

        {/* ماذا بعد الإعداد: يرى التاجر أن الطريق لأول فاتورة قصير */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-primary-foreground/60">
            بعد الإعداد مباشرة
          </h3>
          <ol className="grid grid-cols-3 gap-px bg-primary-foreground/15">
            {SHOWCASE_NEXT_STEPS.map(({ title, description }, i) => (
              <li key={title} className="space-y-1.5 bg-primary p-4">
                <span className="text-2xl font-bold tabular-nums text-primary-foreground/40">
                  0{i + 1}
                </span>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs leading-relaxed text-primary-foreground/70">
                  {description}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-primary-foreground/60">
            كل ما يحتاجه محلك في برنامج واحد
          </h3>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-4">
            {SHOWCASE_FEATURES.map(({ title, description, icon: Icon }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center bg-primary-foreground/10">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs leading-relaxed text-primary-foreground/70">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="relative space-y-4">
        <ul className="grid grid-cols-3 gap-3 border-t border-primary-foreground/15 pt-5">
          {SHOWCASE_TRUST.map(({ title, description, icon: Icon }) => (
            <li key={title} className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Icon className="size-4 shrink-0" aria-hidden />
                {title}
              </p>
              <p className="text-[11px] leading-relaxed text-primary-foreground/60">
                {description}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} {BRAND.name}. جميع الحقوق محفوظة.
        </p>
      </footer>
    </aside>
  );
}
