"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/site-info", label: "현장 정보" },
  { href: "/progress", label: "공정 관리" },
  { href: "/resource-procurement", label: "자원·조달" },
  { href: "/quality-safety", label: "품질·안전" },
  { href: "/design-docs", label: "설계·문서" },
  { href: "/system-admin", label: "시스템 관리" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border bg-background-soft">
      <div className="mx-auto flex h-11 max-w-[1440px] items-center gap-1 overflow-x-auto px-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-border-strong bg-background-card text-foreground shadow-[var(--shadow-soft)]"
                  : "border-transparent text-foreground-muted hover:border-border hover:bg-background-card hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
