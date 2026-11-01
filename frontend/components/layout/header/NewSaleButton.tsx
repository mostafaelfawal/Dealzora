"use client";

import { IconShoppingCartPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ShortcutBadge } from "@/components/shared/ShortcutBadge";
import { Button } from "@/components/ui/button";
import { SHORTCUTS } from "@/config/shortcuts";
import { useHotkey } from "@/hooks/useHotkey";

export function NewSaleButton() {
  const router = useRouter();

  useHotkey(SHORTCUTS.newSale.match, () => router.push("/pos"));

  return (
    <Button
      size="lg"
      nativeButton={false}
      render={<Link href="/pos" />}
      className="gap-2"
    >
      <IconShoppingCartPlus className="size-5" />
      <span className="sr-only sm:not-sr-only">بيع جديد</span>
      <ShortcutBadge className="hidden border-primary-foreground/30 text-primary-foreground/80 lg:inline-flex">
        {SHORTCUTS.newSale.label}
      </ShortcutBadge>
    </Button>
  );
}
