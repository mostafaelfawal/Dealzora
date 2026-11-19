"use client";

import { IconHelpCircle } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** زر «أين الفائدة؟»: التقسيط هنا بلا أي زيادة، لأن الزيادة مقابل الأجل ربا محرّم. */
export function RibaNoticeButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 font-normal"
        onClick={() => setOpen(true)}
      >
        <IconHelpCircle className="size-4" />
        أين الفائدة؟
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-start">
            <DialogTitle>لا فائدة على التقسيط</DialogTitle>
            <DialogDescription>
              يلتزم Dealzora بأحكام الشريعة الإسلامية، فلا يضيف أي فائدة على
              الأقساط، لأن الزيادة مقابل تأخير السداد ربا محرَّم.
            </DialogDescription>
          </DialogHeader>

          <figure className="space-y-3 border-s-4 border-primary bg-muted/40 p-4">
            <blockquote className="text-lg leading-loose">
              عَنْ جَابِرٍ رَضِيَ اللَّهُ عَنْهُ قَالَ: «لَعَنَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ آكِلَ
              الرِّبَا، وَمُؤْكِلَهُ، وَكَاتِبَهُ، وَشَاهِدَيْهِ»، وَقَالَ: «هُمْ سَوَاءٌ».
            </blockquote>
            <figcaption className="text-sm text-muted-foreground">
              رَوَاهُ مُسْلِمٌ (١٥٩٨)
            </figcaption>
          </figure>

          <div className="flex justify-end">
            <Button type="button" onClick={() => setOpen(false)}>
              فهمت
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
