"use client";

import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { useEnvironmentPreview, useSwitchEnvironment } from "../hooks/useEta";
import type { EtaEnvironment } from "../types/eta";

/** نفس كلمة التأكيد في الـ backend (e_receipt/constants.PROD_CONFIRM_TEXT). */
const CONFIRM_WORD = "فعلي";
const NAME: Record<EtaEnvironment, string> = {
  preprod: "التجريبية",
  prod: "الفعلية",
};

/** البيئة الحالية + تغييرها بتأكيد صريح (التحويل للفعلية يحتاج كتابة «فعلي»). */
export function EtaEnvironmentSwitch({ current }: { current: EtaEnvironment }) {
  const [open, setOpen] = useState(false);
  const target: EtaEnvironment = current === "prod" ? "preprod" : "prod";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border p-3">
      <div className="space-y-0.5 text-sm">
        <p>
          البيئة الحالية:{" "}
          <b className={current === "prod" ? "text-success" : "text-warning"}>
            {NAME[current]}
          </b>
        </p>
        <p className="text-xs text-muted-foreground">
          {current === "prod"
            ? "الإيصالات تُرسل للمنظومة الفعلية وتُحتسب رسمياً."
            : "للتجربة فقط: الإيصالات لا تُحتسب رسمياً عند المصلحة."}
        </p>
      </div>
      <Button
        type="button"
        variant={target === "prod" ? "default" : "outline"}
        onClick={() => setOpen(true)}
      >
        التحويل للبيئة {NAME[target]}
      </Button>
      {open && <SwitchDialog target={target} onClose={() => setOpen(false)} />}
    </div>
  );
}

function SwitchDialog({
  target,
  onClose,
}: {
  target: EtaEnvironment;
  onClose: () => void;
}) {
  const preview = useEnvironmentPreview(true);
  const switcher = useSwitchEnvironment();
  const [text, setText] = useState("");
  const needsWord = target === "prod";
  const ready = !needsWord || text.trim() === CONFIRM_WORD;
  const unsent = preview.data?.unsent ?? 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2">
            {needsWord && <IconAlertTriangle className="size-5 text-warning" />}
            التحويل للبيئة {NAME[target]}
          </DialogTitle>
          <DialogDescription>
            {needsWord
              ? "بعد التحويل تُرسل كل الإيصالات الجديدة للمنظومة الفعلية وتُحتسب رسمياً على المحل."
              : "الإيصالات الجديدة ستُرسل للبيئة التجريبية ولن تُحتسب رسمياً."}
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1.5 ps-5 text-sm">
          <li>كل جهاز يبدأ سلسلة إيصالات جديدة في البيئة {NAME[target]}.</li>
          <li className={cn(unsent > 0 && "text-warning")}>
            {preview.isPending ? (
              "جارٍ حساب الإيصالات المعلّقة…"
            ) : unsent > 0 ? (
              <>
                <Num>{unsent}</Num> إيصال على البيئة الحالية لم يكتمل إرسالها:
                ستصبح «غير مطلوب» ولن تُرسل أبداً. أرسلها أولاً لو كانت مهمة.
              </>
            ) : (
              "لا توجد إيصالات معلّقة على البيئة الحالية."
            )}
          </li>
          {needsWord && (
            <li>
              تأكد أن بيانات الأجهزة (Client ID/Secret) هي بيانات البيئة
              الفعلية.
            </li>
          )}
        </ul>

        {needsWord && (
          <div className="space-y-1.5">
            <Label htmlFor="eta-env-confirm">
              للتأكيد اكتب كلمة «<b>{CONFIRM_WORD}</b>»
            </Label>
            <Input
              id="eta-env-confirm"
              value={text}
              autoComplete="off"
              onChange={(e) => setText(e.target.value)}
              className="h-10"
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant={needsWord ? "destructive" : "default"}
            disabled={!ready || switcher.isPending || preview.isPending}
            onClick={() =>
              switcher.mutate(
                { environment: target, confirmText: text },
                { onSuccess: onClose },
              )
            }
            className="gap-2"
          >
            {switcher.isPending && (
              <IconLoader2 className="size-4 animate-spin" />
            )}
            تحويل للبيئة {NAME[target]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
