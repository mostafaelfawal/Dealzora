"use client";

import {
  IconBuildingStore,
  IconChevronLeft,
  IconDeviceDesktop,
  IconPlugConnected,
} from "@tabler/icons-react";
import Link from "next/link";

import { ConnectLink } from "@/features/devices/components/connectLink";
import { isTerminal, useDeviceConfig } from "@/lib/device";

const OTHER_ROLES = [
  {
    href: "/connect",
    icon: IconPlugConnected,
    title: "جهاز كاشير إضافي",
    hint: "يتصل بالجهاز الأساسي في نفس المحل",
  },
  {
    href: "/join-branch",
    icon: IconBuildingStore,
    title: "فرع جديد لمحل موجود",
    hint: "بكود ربط من مالك المحل",
  },
] as const;

/**
 * أول قرار في الإعداد: هل هذا الجهاز الأساسي لمحل جديد؟
 * يظهر قبل النموذج حتى لا يملأ التاجر البيانات على جهاز كان يجب ربطه بمحل قائم.
 */
export function DeviceRoleNotice() {
  const cfg = useDeviceConfig();
  if (!cfg) return null;
  if (isTerminal(cfg)) return <ConnectLink />;

  return (
    <section aria-label="دور هذا الجهاز" className="border bg-card">
      <div className="flex items-start gap-3 p-3">
        <span className="grid size-9 shrink-0 place-items-center bg-primary/10 text-primary">
          <IconDeviceDesktop className="size-5" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">
            هذا الجهاز الأساسي لمحل جديد
          </p>
          <p className="text-xs text-muted-foreground">
            بيانات المحل كلها تُحفظ على هذا الجهاز، ومنه تربط باقي الأجهزة.
          </p>
        </div>
      </div>

      <div className="border-t bg-muted/30 px-3 py-2">
        <p className="mb-1.5 text-xs text-muted-foreground">ليس أول جهاز؟</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {OTHER_ROLES.map(({ href, icon: Icon, title, hint }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-2 border bg-background p-2 transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Icon
                className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium">{title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {hint}
                </span>
              </span>
              <IconChevronLeft
                className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5"
                aria-hidden
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
