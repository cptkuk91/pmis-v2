import type { ReactNode } from "react";

type QaFilterPanelProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

export function QaFilterPanel({
  title = "검색 및 필터",
  description,
  actions,
  footer,
  children,
}: QaFilterPanelProps) {
  return (
    <section className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <div className="mt-4">{children}</div>

      {footer ? <div className="mt-4 border-t border-border pt-4">{footer}</div> : null}
    </section>
  );
}
