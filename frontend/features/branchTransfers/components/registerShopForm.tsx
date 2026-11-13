"use client";

import {
  IconBrandWhatsapp,
  IconBuildingStore,
  IconLoader2,
} from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORT_PHONE, SUPPORT_WHATSAPP } from "@/config/support";
import { useShopName } from "@/features/settings/hooks/useSettings";
import { openWhatsapp } from "@/lib/whatsapp";

import { DEFAULT_SYNC_URL } from "../api/branchTransfers.api";
import { SyncUrlMissing } from "./syncUrlMissing";
import { useRegisterShop } from "../hooks/useBranchTransfers";

/** المالك يسجّل محله على سيرفر الفروع بمفتاح ترخيص «سلسلة»: هذا الجهاز يصبح الفرع الرئيسي. */
export function RegisterShopForm({ allowed }: { allowed: boolean }) {
  const register = useRegisterShop();
  const shopName = useShopName().data;
  const [asking, setAsking] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("الفرع الرئيسي");
  const [code, setCode] = useState("MAIN");
  const [recover, setRecover] = useState(false);
  const codeOk = /^[A-Za-z0-9]{1,12}$/.test(code);
  const valid =
    DEFAULT_SYNC_URL &&
    key.trim().length >= 20 &&
    name.trim().length >= 2 &&
    codeOk;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    register.mutate({
      serverUrl: DEFAULT_SYNC_URL,
      licenseKey: key.trim(),
      branchName: name.trim(),
      branchCode: code.toUpperCase(),
      recover,
    });
  }

  /** واتساب الدعم برسالة جاهزة: المالك نسي مفتاح ترخيص محله. */
  async function forgotKey() {
    setAsking(true);
    try {
      await openWhatsapp(
        SUPPORT_WHATSAPP,
        `السلام عليكم، لقد نسيت مفتاح ترخيصي لمحلي ${shopName?.trim() || ""}`.trim(),
      );
    } catch {
      toast.error(`تعذّر فتح واتساب. تواصل معنا مباشرة على ${SUPPORT_PHONE}`);
    } finally {
      setAsking(false);
    }
  }

  if (!DEFAULT_SYNC_URL) return <SyncUrlMissing />;

  return (
    <form onSubmit={submit} className="space-y-4">
      <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
        <li>الصق مفتاح ترخيص خطة «سلسلة» الذي وصلك عند الاشتراك.</li>
        <li>يُنشأ محلك على سيرفر الفروع، ويصبح هذا الجهاز «الفرع الرئيسي».</li>
        <li>بعدها تضيف فروعك وتُصدر كود ربط لكل فرع من هنا مباشرة.</li>
      </ol>

      <div className="space-y-1.5">
        <Label htmlFor="rs-key">مفتاح الترخيص</Label>
        <Textarea
          id="rs-key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="الصق مفتاح الترخيص هنا"
          dir="ltr"
          rows={3}
          autoComplete="off"
          spellCheck={false}
          className="font-mono text-xs break-all"
          disabled={!allowed}
        />
        <button
          type="button"
          onClick={() => void forgotKey()}
          disabled={asking}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-60"
        >
          <IconBrandWhatsapp className="size-3.5" />
          نسيت مفتاح الترخيص؟
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor="rs-name">اسم هذا الفرع</Label>
          <Input
            id="rs-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="h-10"
            disabled={!allowed || recover}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rs-code">رمز الفرع</Label>
          <Input
            id="rs-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={12}
            dir="ltr"
            aria-invalid={!codeOk}
            className="h-10 font-mono"
            disabled={!allowed || recover}
          />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={recover}
          onCheckedChange={(v) => setRecover(v === true)}
          disabled={!allowed}
          className="mt-0.5"
        />
        <span>
          استرجاع محل مسجّل من قبل
          <span className="block text-xs text-muted-foreground">
            لجهاز رئيسي جديد بدلاً من جهاز تعطّل أو استُبدل. الجهاز القديم يتوقف
            فوراً.
          </span>
        </span>
      </label>

      <div className="flex justify-end border-t pt-3">
        <Button
          type="submit"
          size="lg"
          className="h-10 gap-2"
          disabled={!allowed || !valid || register.isPending}
        >
          {register.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconBuildingStore className="size-4" />
          )}
          {recover ? "استرجاع المحل" : "تسجيل المحل"}
        </Button>
      </div>
    </form>
  );
}
