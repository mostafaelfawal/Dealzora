"use client";

import {
  IconBrandWhatsapp,
  IconHelpCircle,
  IconLoader2,
} from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SUPPORT_PHONE, SUPPORT_WHATSAPP } from "@/config/support";
import { openWhatsapp } from "@/lib/whatsapp";

const MESSAGE = "السلام عليكم، عندي مشكلة في برنامج Dealzora:\n";

/** «عندك مشكلة؟» في الشريط العلوي: نافذة فيها زر واتساب للدعم برسالة جاهزة. */
export function SupportButton() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function contact() {
    setSending(true);
    try {
      await openWhatsapp(SUPPORT_WHATSAPP, MESSAGE);
      setOpen(false);
    } catch {
      toast.error(`تعذّر فتح واتساب. تواصل معنا مباشرة على ${SUPPORT_PHONE}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <AppTooltip message="عندك مشكلة؟">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="عندك مشكلة؟ تواصل مع الدعم"
          onClick={() => setOpen(true)}
        >
          <IconHelpCircle className="size-5" />
        </Button>
      </AppTooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-4 sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
              <IconBrandWhatsapp className="size-7" />
            </span>
            <DialogTitle>عندك مشكلة؟</DialogTitle>
            <DialogDescription>
              فريق Dealzora جاهز يساعدك. ابعتلنا على واتساب واكتب المشكلة، ولو
              تقدر ابعت صورة من الشاشة.
            </DialogDescription>
          </DialogHeader>

          <Button
            size="lg"
            disabled={sending}
            onClick={() => void contact()}
            className="h-11 w-full gap-2"
          >
            {sending ? (
              <IconLoader2 className="size-5 animate-spin" />
            ) : (
              <IconBrandWhatsapp className="size-5" />
            )}
            تواصل معنا على واتساب
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            أو اتصل بنا:{" "}
            <bdi
              dir="ltr"
              className="font-mono font-medium text-foreground select-all"
            >
              {SUPPORT_PHONE}
            </bdi>
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
