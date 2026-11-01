"use client";

import { IconMenu2 } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { SidebarBrand } from "../sidebar/SidebarBrand";
import { SidebarNav } from "../sidebar/SidebarNav";

/** القائمة الجانبية على الموبايل والتابلت (تحت 1024px). */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="lg:hidden"
            aria-label="فتح القائمة"
          />
        }
      >
        <IconMenu2 className="size-5" />
      </SheetTrigger>

      <SheetContent side="right" showCloseButton={false} className="gap-0 p-0">
        <SheetTitle className="sr-only">القائمة الرئيسية</SheetTitle>
        <SheetDescription className="sr-only">
          التنقل بين صفحات النظام
        </SheetDescription>
        <SidebarBrand onNavigate={close} />
        <SidebarNav onNavigate={close} />
      </SheetContent>
    </Sheet>
  );
}
