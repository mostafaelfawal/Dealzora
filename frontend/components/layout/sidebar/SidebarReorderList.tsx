"use client";

import {
  IconArrowBarToDown,
  IconArrowBarToUp,
  IconGripVertical,
} from "@tabler/icons-react";
import { LazyMotion, useDragControls } from "framer-motion";
import { Reorder } from "framer-motion/m";

import { AppTooltip } from "@/components/shared/AppTooltip";
import { tSpring } from "@/components/shared/motion";
import { Button } from "@/components/ui/button";
import type { NavItem } from "@/types/navigation";

// السحب والترتيب يحتاجان domMax؛ نحمّله فقط عند فتح وضع التخصيص.
const loadDomMax = () => import("framer-motion").then((mod) => mod.domMax);

interface SidebarReorderListProps {
  label: string;
  items: NavItem[];
  onReorder: (hrefs: string[]) => void;
  /** "down": زر النقل إلى "أقل استخداماً"، "up": زر الإرجاع. */
  move: "down" | "up";
  onMove: (href: string) => void;
}

function ReorderRow({
  item,
  move,
  onMove,
}: {
  item: NavItem;
  move: "down" | "up";
  onMove: (href: string) => void;
}) {
  // السحب من المقبض فقط، حتى يبقى تمرير القائمة باللمس ممكناً.
  const controls = useDragControls();
  const Icon = item.icon;
  const MoveIcon = move === "down" ? IconArrowBarToDown : IconArrowBarToUp;
  const moveLabel =
    move === "down"
      ? `نقل ${item.title} إلى أقل استخداماً`
      : `إرجاع ${item.title} إلى مكانه`;

  return (
    <Reorder.Item
      value={item.href}
      dragListener={false}
      dragControls={controls}
      transition={tSpring}
      whileDrag={{ scale: 1.03, boxShadow: "0 6px 16px rgb(0 0 0 / 0.15)" }}
      aria-label={`${item.title}. اضغط مسافة للإمساك ثم الأسهم للتحريك`}
      className="relative flex h-10 items-center gap-2 bg-sidebar pe-1 text-sm text-muted-foreground outline-none select-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <span
        aria-hidden
        onPointerDown={(event) => controls.start(event)}
        className="flex h-full w-7 shrink-0 cursor-grab touch-none items-center justify-center hover:text-foreground active:cursor-grabbing"
      >
        <IconGripVertical className="size-4" />
      </span>
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{item.title}</span>
      <AppTooltip message={moveLabel} side="left">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={moveLabel}
          onClick={() => onMove(item.href)}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoveIcon className="size-4" />
        </Button>
      </AppTooltip>
    </Reorder.Item>
  );
}

/** قائمة صفحات قابلة لإعادة الترتيب بالسحب (أو بالمسافة والأسهم من لوحة المفاتيح). */
export function SidebarReorderList({
  label,
  items,
  onReorder,
  move,
  onMove,
}: SidebarReorderListProps) {
  return (
    <LazyMotion features={loadDomMax} strict>
      <Reorder.Group
        axis="y"
        aria-label={label}
        values={items.map((item) => item.href)}
        onReorder={onReorder}
        className="space-y-0.5"
      >
        {items.map((item) => (
          <ReorderRow key={item.href} item={item} move={move} onMove={onMove} />
        ))}
      </Reorder.Group>
    </LazyMotion>
  );
}
