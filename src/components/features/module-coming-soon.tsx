import Link from "next/link";

type ModuleMenuLink = {
  href: string;
  label: string;
};

type ModuleComingSoonProps = {
  moduleName: string;
  pageTitle: string;
  description: string;
  roadmapItems: string[];
  menuLinks: ModuleMenuLink[];
};

export function ModuleComingSoon({
  moduleName,
  pageTitle,
  description,
  roadmapItems,
  menuLinks,
}: ModuleComingSoonProps) {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-muted">{moduleName}</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{pageTitle}</h1>
        <p className="mt-2 text-sm text-foreground-muted">{description}</p>
        <p className="mt-4 inline-flex rounded-md border border-border bg-background-soft px-3 py-1.5 text-xs font-medium text-foreground">
          준비중입니다.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-sm font-semibold text-foreground">우선 구현 항목</h2>
          <ul className="mt-3 space-y-2 text-sm text-foreground-muted">
            {roadmapItems.map((item) => (
              <li key={item} className="rounded-md bg-background-soft px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-sm font-semibold text-foreground">모듈 메뉴</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {menuLinks.map((menu) => (
              <Link
                key={menu.href}
                href={menu.href}
                className="rounded-md border border-border bg-background-soft px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background-card"
              >
                {menu.label}
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
