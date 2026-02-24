"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const subMenus = [
  { href: "/site-info/overview", label: "공사개요" },
  { href: "/site-info/history", label: "사업연혁" },
  { href: "/site-info/people", label: "인원정보" },
  { href: "/site-info/construction-plans", label: "시공계획" },
  { href: "/site-info/specifications", label: "시방서" },
  { href: "/site-info/methods", label: "주요공법" },
  { href: "/site-info/visitors", label: "방문자현황" },
];

export default function SiteInfoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-card p-1">
        {subMenus.map((menu) => {
          const isActive =
            pathname === menu.href || pathname.startsWith(menu.href + "/");
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
