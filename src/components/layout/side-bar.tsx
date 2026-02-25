import Link from "next/link";

const quickLinks = [
  { href: "/dashboard/notices", label: "공지사항" },
  { href: "/dashboard/meetings", label: "금일회의" },
  { href: "/dashboard/pending-docs", label: "미결문서" },
  { href: "/dashboard/ui-lab", label: "UI 테스트 페이지" },
];

export function SideBar() {
  return (
    <aside className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Links</h2>
      <ul className="space-y-2">
        {quickLinks.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-md px-2 py-1.5 text-sm text-foreground-muted hover:bg-background-soft hover:text-foreground"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-border pt-4">
        <h3 className="mb-2 text-xs font-semibold text-foreground-muted">외부 링크</h3>
        <ul className="space-y-1 text-sm text-foreground-muted">
          <li>
            <Link href="/progress/weather" className="hover:text-foreground">
              Open-Meteo 날씨
            </Link>
          </li>
          <li>
            <Link href="/system-admin/integrations/dis" className="hover:text-foreground">
              DIS 연계
            </Link>
          </li>
          <li>
            <Link href="/system-admin/support" className="hover:text-foreground">
              Support
            </Link>
          </li>
        </ul>
      </div>
    </aside>
  );
}
