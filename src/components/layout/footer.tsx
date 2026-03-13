export function Footer() {
  return (
    <footer className="border-t border-border bg-background-soft">
      <div className="mx-auto flex h-10 max-w-[1440px] items-center justify-between px-4 text-xs text-foreground-muted">
        <span>PMIS Core Platform</span>
        <div className="flex items-center gap-3">
          <a
            className="transition-colors hover:text-foreground"
            href="https://github.com/cptkuk91"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <span>Copyright © PMIS</span>
        </div>
      </div>
    </footer>
  );
}
