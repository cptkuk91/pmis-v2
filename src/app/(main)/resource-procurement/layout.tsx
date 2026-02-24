"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuGroups = [
  {
    label: "자재/장비",
    items: [
      { href: "/resource-procurement/materials/plan-actual", label: "자재 계획/실적" },
      { href: "/resource-procurement/equipment/plan-actual", label: "장비 계획/실적" },
    ],
  },
  {
    label: "자재공급원",
    items: [
      { href: "/resource-procurement/supplier-approvals/requests", label: "승인요청" },
      { href: "/resource-procurement/supplier-approvals/status", label: "승인현황" },
    ],
  },
  {
    label: "반입검수",
    items: [
      { href: "/resource-procurement/material-inspections/requests", label: "검수요청" },
      { href: "/resource-procurement/material-inspections/register", label: "검수등록" },
      { href: "/resource-procurement/material-inspections/ledger", label: "검수대장" },
    ],
  },
  {
    label: "인력관리",
    items: [
      { href: "/resource-procurement/workforce/daily", label: "일일출역" },
      { href: "/resource-procurement/workforce/roster", label: "연명부" },
      { href: "/resource-procurement/workforce/summary", label: "집계" },
      { href: "/resource-procurement/workforce/analysis", label: "분석" },
    ],
  },
  {
    label: "하도급",
    items: [
      { href: "/resource-procurement/subcontract/reviews/new", label: "검토요청" },
      { href: "/resource-procurement/subcontract/review-ledger", label: "검토대장" },
    ],
  },
  {
    label: "손익",
    items: [
      { href: "/resource-procurement/profit-loss", label: "매출손익" },
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
