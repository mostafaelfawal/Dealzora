"use client";

import {
  IconCalendarEvent,
  IconCalendarOff,
  IconDiscount2,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { StatTile } from "@/components/shared/StatTile";
import { listItem, MotionLi } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  useDeletePromotion,
  usePromotions,
  useTogglePromotion,
} from "../hooks/usePromotions";
import {
  promoHeadline,
  promoPeriodText,
  promoScopeText,
  STATUS_INFO,
} from "../lib/promotionText";
import type { Promotion, PromoStatus } from "../types/promotion";
import { PromotionFormDialog } from "./promotionFormDialog";

function PromotionCard({
  p,
  index,
  onEdit,
  onDelete,
}: {
  p: Promotion;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const toggle = useTogglePromotion();
  const info = STATUS_INFO[p.status];
  return (
    <MotionLi
      {...listItem(index)}
      className="flex flex-col gap-3 border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center bg-success/10 text-success">
          <IconDiscount2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{p.name}</p>
          <p className="text-sm text-primary">{promoHeadline(p)}</p>
        </div>
        <span
          className={cn("shrink-0 px-1.5 py-0.5 text-[11px]", info.className)}
        >
          {info.label}
        </span>
      </div>
      <dl className="space-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>على:</dt>
          <dd className="truncate text-foreground">{promoScopeText(p)}</dd>
        </div>
        <div className="flex items-center gap-1">
          {p.endsOn ? (
            <IconCalendarEvent className="size-3.5" />
          ) : (
            <IconCalendarOff className="size-3.5" />
          )}
          <dd>{promoPeriodText(p)}</dd>
        </div>
        {p.minQty && p.kind !== "buy_get" && <dd>من {p.minQty} قطع فأكثر</dd>}
      </dl>
      <div className="mt-auto flex gap-1.5 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onEdit}
        >
          <IconPencil className="size-4" />
          تعديل
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(p)}
        >
          {p.isActive ? (
            <>
              <IconPlayerPause className="size-4" /> إيقاف
            </>
          ) : (
            <>
              <IconPlayerPlay className="size-4" /> تشغيل
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ms-auto gap-1.5 text-destructive"
          onClick={onDelete}
        >
          <IconTrash className="size-4" />
          حذف
        </Button>
      </div>
    </MotionLi>
  );
}

/** العروض التلقائية: اشتري واحصل، خصم بنسبة، خصم مبلغ. تُطبق في الكاشير بدون تدخل. */
export function PromotionsScreen() {
  const query = usePromotions();
  const remove = useDeletePromotion();
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [filter, setFilter] = useState<PromoStatus | "all">("all");

  const items = query.data ?? [];
  const count = (s: PromoStatus) => items.filter((p) => p.status === s).length;
  const shown =
    filter === "all" ? items : items.filter((p) => p.status === filter);
  const tile = (s: PromoStatus) => ({
    active: filter === s,
    onClick: () => setFilter(filter === s ? "all" : s),
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="العروض"
        description="اعمل عرض مرة واحدة، والكاشير يطبقه لوحده على الفاتورة: اشتري 2 وخد 1، أو خصم على أصناف معينة لمدة محددة."
        actions={
          <Button
            size="lg"
            className="h-10 gap-2"
            onClick={() => setCreating(true)}
          >
            <IconPlus className="size-4" />
            عرض جديد
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile
          index={0}
          icon={<IconPlayerPlay />}
          label="شغالة الآن"
          tone="success"
          {...tile("active")}
        >
          {count("active")}
        </StatTile>
        <StatTile
          index={1}
          icon={<IconCalendarEvent />}
          label="تبدأ قريباً"
          {...tile("scheduled")}
        >
          {count("scheduled")}
        </StatTile>
        <StatTile
          index={2}
          icon={<IconPlayerPause />}
          label="متوقفة"
          tone="warning"
          {...tile("paused")}
        >
          {count("paused")}
        </StatTile>
        <StatTile
          index={3}
          icon={<IconCalendarOff />}
          label="انتهت"
          {...tile("expired")}
        >
          {count("expired")}
        </StatTile>
      </div>

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border bg-card p-10 text-center">
          <IconDiscount2 className="size-10 text-muted-foreground" />
          <p className="font-medium">
            {items.length ? "لا عروض هنا" : "لا توجد عروض بعد"}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            جرّب «اشتري 2 وخد 1» على صنف بطيء البيع، أو خصم 10% على قسم كامل لمدة
            أسبوع.
          </p>
          {!items.length && (
            <Button onClick={() => setCreating(true)} className="gap-2">
              <IconPlus className="size-4" />
              أول عرض
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p, i) => (
            <PromotionCard
              key={p.id}
              p={p}
              index={i}
              onEdit={() => setEditing(p)}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </ul>
      )}

      <PromotionFormDialog
        open={creating || editing !== null}
        promotion={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader className="text-start">
            <DialogTitle>حذف «{deleting?.name}»؟</DialogTitle>
            <DialogDescription>
              الفواتير القديمة تحتفظ بخصمها. لو عايز توقفه مؤقتاً استخدم «إيقاف».
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              رجوع
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                deleting &&
                remove.mutate(deleting, { onSuccess: () => setDeleting(null) })
              }
            >
              حذف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
