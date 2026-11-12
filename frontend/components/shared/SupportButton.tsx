"use client";

import {
  IconHelpCircle,
  IconLoader2,
  IconPhone,
  IconBrandWhatsapp,
  IconBrandLinkedin,
} from "@tabler/icons-react";

import {
  siFacebook,
  siInstagram,
  siYoutube,
  siTiktok,
  siX,
  siWhatsapp,
} from "simple-icons";

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
import { openExternal } from "@/lib/external";
import { openWhatsapp } from "@/lib/whatsapp";

const MESSAGE = "السلام عليكم، عندي مشكلة في برنامج Dealzora:\n";

const SOCIAL_LINKS = [
  {
    name: "WhatsApp Group",
    icon: siWhatsapp,
    url: "https://chat.whatsapp.com/FCKYptydOcOEMrUb7bTTxt",
  },
  {
    name: "Facebook",
    icon: siFacebook,
    url: "https://www.facebook.com/profile.php?id=61596279460515",
  },
  {
    name: "Instagram",
    icon: siInstagram,
    url: "https://www.instagram.com/_dealzora_",
  },
  {
    name: "YouTube",
    icon: siYoutube,
    url: "https://www.youtube.com/@dealzora-s",
  },
  {
    name: "TikTok",
    icon: siTiktok,
    url: "https://www.tiktok.com/@_dealzora_",
  },
  {
    name: "X (Twitter)",
    icon: siX,
    url: "https://x.com/_dealzora_",
  },
];

/** زر الدعم الفني في الشريط العلوي. */
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

  /** الـ WebView في Tauri مابيفتحش <a target="_blank">، فبنفتح الرابط بأنفسنا. */
  function handleExternalClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const url = e.currentTarget.href;
    openExternal(url).catch(() => toast.error("تعذّر فتح الرابط"));
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
        <DialogContent className="gap-5 sm:max-w-sm">
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

          <div className="space-y-3 border-t pt-4">
            <p className="text-center text-xs font-medium text-muted-foreground">
              تابعنا على منصات التواصل الاجتماعي
            </p>

            <div className="flex flex-nowrap items-center justify-center gap-1.5">
              {SOCIAL_LINKS.map((social) => {
                const isTabler = social.name === "LinkedIn";

                return (
                  <AppTooltip message={social.name} key={social.name}>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleExternalClick}
                      className="flex size-8 shrink-0 items-center justify-center border
                      border-border bg-background text-muted-foreground
                      transition-colors hover:bg-muted hover:text-foreground
                      rounded-none"
                    >
                      {isTabler ? (
                        <IconBrandLinkedin className="size-4" />
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          className="size-4"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d={social.icon.path} />
                        </svg>
                      )}
                    </a>
                  </AppTooltip>
                );
              })}

              {/* Phone */}
              <AppTooltip message="اتصل بنا">
                <a
                  href={`tel:${SUPPORT_PHONE}`}
                  onClick={handleExternalClick}
                  className="flex size-8 shrink-0 items-center justify-center border
                  border-border bg-background text-muted-foreground
                  transition-colors hover:bg-muted hover:text-foreground
                  rounded-none"
                >
                  <IconPhone className="size-4" />
                </a>
              </AppTooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
