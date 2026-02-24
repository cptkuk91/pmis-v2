import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "default" | "info" | "success" | "warning" | "danger";

const toneClassMap: Record<BadgeTone, string> = {
  default: "border-border bg-background-soft text-foreground",
  info: "border-[#d8e8ff] bg-[#f4f8ff] text-[#3b5f93]",
  success: "border-[#d7eadc] bg-[#f4fbf5] text-[#2f6b43]",
  warning: "border-[#f0e4d0] bg-[#fff9ef] text-[#8d651f]",
  danger: "border-[#efd7d4] bg-[#fff5f4] text-[#8e413c]",
};

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
};

export function Badge({ children, tone = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClassMap[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
