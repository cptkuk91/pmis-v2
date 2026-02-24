import Link from "next/link";

export default function DesignDocsPage() {
  const sections = [
    { href: "/design-docs/design/reviews", label: "도면검토현황" },
    { href: "/design-docs/design/drawings", label: "도면목록" },
    { href: "/design-docs/design/changes", label: "설계변경현황" },
    { href: "/design-docs/design/assets", label: "설계자료관리(트리)" },
    { href: "/design-docs/documents/wizard/1", label: "문서작성 위저드" },
    { href: "/design-docs/documents/ledgers/instruction", label: "업무지시서 대장" },
    { href: "/design-docs/documents/ledgers/outbound", label: "발송대장" },
    { href: "/design-docs/documents/ledgers/inbound", label: "접수대장" },
    { href: "/design-docs/documents/search", label: "문서검색" },
    { href: "/design-docs/documents/categories", label: "문서분류체계" },
    { href: "/design-docs/documents/system", label: "Document System" },
    { href: "/design-docs/documents/templates", label: "양식함" },
  ];

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">설계·문서</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Phase 3 1팀 모듈 시작 상태입니다. 도면검토/문서작성/대장/분류체계를 순차 구현합니다.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((item) => (
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
