"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const subMenus = [
  { href: "/progress", label: "진행 개요" },
  { href: "/progress/reports", label: "현장 리포트" },
  { href: "/progress/master-schedule", label: "공정 추적" },
  { href: "/progress/calendar", label: "일정 캘린더" },
  { href: "/progress/weather", label: "현장 날씨" },
];

export default function ProgressLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-card p-1">
        {subMenus.map((menu) => {
          const isRoot = menu.href === "/progress";
          const isActive = isRoot
            ? pathname === menu.href
            : pathname === menu.href || pathname.startsWith(menu.href + "/");

          return (
              <Link
                key={menu.href}
                href={menu.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[#ecebe8] font-medium text-foreground"
                    : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
                }`}
              >
                {menu.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
