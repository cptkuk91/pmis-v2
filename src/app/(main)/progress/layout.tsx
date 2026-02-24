"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const subMenus = [
  { href: "/progress", label: "공정 메인" },
  { href: "/progress/reports", label: "보고서" },
  { href: "/progress/daily-safety-log", label: "공사안전일지" },
  { href: "/progress/master-schedule", label: "Master/주간 공정표" },
  { href: "/progress/comparison", label: "실적대비(S-Curve)" },
  { href: "/progress/calendar", label: "Project Calendar" },
  { href: "/progress/weather", label: "기상자료" },
  { href: "/progress/photos", label: "공정진행사진" },
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
