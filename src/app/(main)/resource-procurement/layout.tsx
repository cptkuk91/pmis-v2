"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuGroups = [
  {
    label: "자재·장비",
    items: [
      { href: "/resource-procurement/materials/plan-actual", label: "자재 현황" },
      { href: "/resource-procurement/equipment/plan-actual", label: "장비 현황" },
    ],
  },
  {
    label: "업체 승인",
    items: [
      { href: "/resource-procurement/supplier-approvals", label: "업체 승인" },
    ],
  },
  {
    label: "인력관리",
    items: [
      { href: "/resource-procurement/workforce/daily", label: "일일 근태" },
      { href: "/resource-procurement/workforce/statistics", label: "근태 통계" },
    ],
  },
  {
    label: "협력사",
    items: [
      { href: "/resource-procurement/subcontract", label: "협력사 관리" },
    ],
  },
  {
    label: "원가",
    items: [
      { href: "/resource-procurement/profit-loss", label: "원가 집계" },
    ],
  },
];

export default function ResourceProcurementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-card p-1">
        {menuGroups.map((group) =>
          group.items.map((menu) => {
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
          }),
        )}
      </nav>
      {children}
    </div>
  );
}
