"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuGroups = [
  {
    label: "안전방침/기준",
    items: [
      { href: "/quality-safety/safety/policies", label: "안전방침" },
      { href: "/quality-safety/safety/standards/hazard", label: "유해위험방지" },
      { href: "/quality-safety/safety/standards/plan", label: "안전관리계획" },
      { href: "/quality-safety/safety/standards/partner", label: "협력사계획" },
      { href: "/quality-safety/safety/regulations", label: "안전기준" },
    ],
  },
  {
    label: "안전관리",
    items: [
      { href: "/quality-safety/safety/management/setup", label: "개설시" },
      { href: "/quality-safety/safety/management/ongoing", label: "진행중" },
      { href: "/quality-safety/safety/management/completion", label: "준공시" },
    ],
  },
  {
    label: "포상/점검",
    items: [
      { href: "/quality-safety/safety/rewards/accident-free", label: "무재해목표" },
      { href: "/quality-safety/safety/rewards/mileage", label: "마일리지" },
      { href: "/quality-safety/safety/rewards/checklist", label: "체크리스트" },
    ],
  },
  {
    label: "교육/건강",
    items: [
      { href: "/quality-safety/safety/laws", label: "안전법규" },
      { href: "/quality-safety/safety/education/training", label: "안전교육" },
      { href: "/quality-safety/safety/education/equipment", label: "보호구지급" },
      { href: "/quality-safety/safety/education/health", label: "건강검진" },
      { href: "/quality-safety/safety/education/accident-free", label: "무재해현황" },
      { href: "/quality-safety/safety/education/new-worker", label: "신규교육" },
    ],
  },
  {
    label: "시설물",
    items: [
      { href: "/quality-safety/safety/facilities/standard", label: "표준시설물" },
      { href: "/quality-safety/safety/facilities/excellent", label: "우수시설물" },
    ],
  },
];

export default function QualitySafetyLayout({
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
