"use client";
import {
  Content,
  Portal,
  Root,
  Provider,
  Trigger,
} from "@radix-ui/react-tooltip";
import { ReactNode } from "react";

type TooltipProps = {
  children: ReactNode;
  message: string;
  side?: "top" | "right" | "bottom" | "left";
};

export default function Tooltip({
  children,
  message,
  side = "left",
}: TooltipProps) {
  return (
    <Provider delayDuration={300}>
      <Root>
        <Trigger asChild>{children}</Trigger>
        <Portal>
          <Content
            side={side}
            align="center"
            sideOffset={5}
            className="z-4 bg-gray-800 dark:bg-gray-700 text-white dark:text-gray-100 
                       text-sm px-3 py-1.5 rounded-md shadow-lg select-none 
                       animate-fadeIn"
          >
            {message}
          </Content>
        </Portal>
      </Root>
    </Provider>
  );
}
