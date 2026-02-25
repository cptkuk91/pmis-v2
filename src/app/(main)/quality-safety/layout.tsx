"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuGroups = [
  {
    id: "policy",
    label: "정책·규정",
    items: [
      { href: "/quality-safety/safety/policies", label: "안전 정책" },
      { href: "/quality-safety/safety/regulations", label: "안전 규정" },
      { href: "/quality-safety/safety/laws", label: "법령/가이드" },
    ],
  },
  {
    id: "planning",
    label: "계획·점검",
    items: [
      { href: "/quality-safety/safety/standards/hazard", label: "위험성 평가" },
      { href: "/quality-safety/safety/standards/plan", label: "안전 실행계획" },
      { href: "/quality-safety/safety/standards/partner", label: "협력사 안전계획" },
      { href: "/quality-safety/safety/rewards/checklist", label: "점검 체크리스트" },
    ],
  },
  {
    id: "operation",
    label: "운영 관리",
    items: [
      { href: "/quality-safety/safety/management/daily-log", label: "안전 일지" },
      { href: "/quality-safety/safety/management/setup", label: "착수 준비" },
      { href: "/quality-safety/safety/management/ongoing", label: "운영 리포트" },
      { href: "/quality-safety/safety/management/completion", label: "사고/조치 이력" },
    ],
  },
  {
    id: "education",
    label: "교육·보건",
    items: [
      { href: "/quality-safety/safety/education/training", label: "정기 교육" },
      { href: "/quality-safety/safety/education/new-worker", label: "신규자 온보딩" },
      { href: "/quality-safety/safety/education/equipment", label: "보호구 지급" },
      { href: "/quality-safety/safety/education/health", label: "건강 관리" },
      { href: "/quality-safety/safety/education/accident-free", label: "무재해 현황" },
    ],
  },
  {
    id: "outcome",
    label: "성과·시설",
    items: [
      { href: "/quality-safety/safety/rewards/accident-free", label: "무재해 인센티브" },
      { href: "/quality-safety/safety/rewards/mileage", label: "안전 포인트" },
      { href: "/quality-safety/safety/facilities/standard", label: "표준 시설" },
      { href: "/quality-safety/safety/facilities/excellent", label: "우수 사례" },
    ],
  },
];

export default function QualitySafetyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeGroup =
    menuGroups.find((group) =>
      group.items.some((menu) => pathname === menu.href || pathname.startsWith(menu.href + "/")),
    ) ?? menuGroups[0];

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-card p-1">
        {menuGroups.map((group) => {
          const isGroupActive = group.id === activeGroup.id;
          return (
            <Link
              key={group.id}
              href={group.items[0].href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                isGroupActive
                  ? "bg-[#ecebe8] font-medium text-foreground"
                  : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
              }`}
            >
              {group.label}
            </Link>
          );
        })}
      </nav>
      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-card p-1">
        {activeGroup.items.map((menu) => {
          const isActive = pathname === menu.href || pathname.startsWith(menu.href + "/");
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
