"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { type VariantProps } from "class-variance-authority";
import { cn } from "cn";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useInsideTooltip,
} from "./tooltip";
import { buttonVariants } from "./button-variants";

function Button({
  className,
  variant = "default",
  size = "default",
  tooltip = true,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /**
     * الزر الأيقوني (بلا نص ظاهر) يعرض aria-label تلميحاً تلقائياً،
     * حتى لا يخمّن المستخدم معنى الأيقونة. false لإيقافه.
     */
    tooltip?: boolean;
  }) {
  const insideTooltip = useInsideTooltip();
  const button = (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );

  const label = props["aria-label"];
  const iconOnly = typeof size === "string" && size.startsWith("icon");
  if (!tooltip || !iconOnly || insideTooltip || !label) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export { Button, buttonVariants };
