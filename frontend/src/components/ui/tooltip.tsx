"use client";

import * as React from "react";
import { Tooltip } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

function TooltipProvider({ children, ...props }: React.ComponentProps<typeof Tooltip.Provider>) {
  return (
    <Tooltip.Provider delay={200} closeDelay={100} {...props}>
      {children}
    </Tooltip.Provider>
  );
}

type InfoTooltipProps = {
  /** Tooltip body (paragraphs as string with \\n\\n or React nodes). */
  content: React.ReactNode;
  /** Accessible name for the trigger button. */
  label?: string;
  /** Recommended card uses dark blue — use onDark for contrast. */
  variant?: "default" | "onDark";
  className?: string;
};

function InfoTooltip({ content, label = "How this is calculated", variant = "default", className }: InfoTooltipProps) {
  const body =
    typeof content === "string" ? (
      <div className="whitespace-pre-line">{content}</div>
    ) : (
      <div className="space-y-2">{content}</div>
    );

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        type="button"
        delay={200}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold italic leading-none transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variant === "onDark"
            ? "border-white/50 text-white hover:bg-white/15 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
            : "border-border text-muted-foreground hover:bg-muted focus-visible:ring-offset-2",
        )}
        aria-label={label}
      >
        i
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" sideOffset={8} align="start">
          <Tooltip.Popup
            className={cn(
              "z-50 max-w-md max-h-[70vh] overflow-y-auto rounded-md border bg-popover px-3 py-2 text-left text-xs text-popover-foreground shadow-md",
              "leading-relaxed",
              className,
            )}
          >
            {body}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export { TooltipProvider, InfoTooltip };
