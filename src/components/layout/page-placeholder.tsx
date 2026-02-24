type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-foreground-muted">{description}</p>
    </section>
  );
}
