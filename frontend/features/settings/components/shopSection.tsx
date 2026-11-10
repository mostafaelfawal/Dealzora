"use client";

import { IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SHOP_NAME_LIMITS } from "../config/settingsOptions";
import { useRenameShop, useShopName } from "../hooks/useSettings";

const FIELD_ID = "shop-name";

/** اسم المحل. null = لم يُعدَّل بعد (يُعرض الاسم المحفوظ). */
export function ShopSection() {
  const shop = useShopName();
  const rename = useRenameShop();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? shop.data ?? "";
  const valid = value.trim().length >= SHOP_NAME_LIMITS.min;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid)
          rename.mutate(value.trim(), { onSuccess: () => setDraft(null) });
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor={FIELD_ID}>اسم المحل (يظهر على الفاتورة)</Label>
        <Input
          id={FIELD_ID}
          value={value}
          maxLength={SHOP_NAME_LIMITS.max}
          onChange={(e) => setDraft(e.target.value)}
          className="h-10"
        />
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={!valid || draft === null || rename.isPending}
        className="h-10 gap-2"
      >
        {rename.isPending ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconDeviceFloppy className="size-4" />
        )}
        حفظ
      </Button>
    </form>
  );
}
