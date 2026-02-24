import Link from "next/link";

const menuItems = [
  { href: "/system-admin/common/meetings", label: "회의개최현황" },
  { href: "/system-admin/common/minutes", label: "회의록" },
  { href: "/system-admin/common/issues", label: "ISSUE" },
  { href: "/system-admin/common/library", label: "자료실" },
  { href: "/system-admin/common/law-info", label: "법률정보" },
  { href: "/system-admin/common/ks-info", label: "KS 규격검색" },
  { href: "/system-admin/common/pro-sites", label: "전문사이트" },
  { href: "/system-admin/codes/partners", label: "관련사 코드관리" },
  { href: "/system-admin/codes/materials", label: "자재 코드관리" },
  { href: "/system-admin/codes/equipment", label: "장비 코드관리" },
  { href: "/system-admin/integrations/wis", label: "WIS 연동" },
  { href: "/system-admin/integrations/dis", label: "DIS 연동" },
  { href: "/system-admin/sites", label: "현장 등록/관리" },
  { href: "/system-admin/support/faq", label: "Online Support FAQ" },
  { href: "/system-admin/support/tickets", label: "문의/문제신고" },
];

export default function SystemAdminPage() {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">시스템 관리</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          공통 게시판/회의/외부링크/코드관리 + WIS/DIS/Online Support
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md border border-border bg-background-soft px-4 py-3 text-sm font-medium text-foreground hover:bg-background-card"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
