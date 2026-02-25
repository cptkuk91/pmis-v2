"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const subMenus = [
  { href: "/site-info/overview", label: "현장 개요" },
  { href: "/site-info/people", label: "관계자 현황" },
  { href: "/site-info/technical-docs", label: "기술 문서" },
  { href: "/site-info/visitors", label: "방문자 관리" },
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
