import Link from "next/link";
import { signOut } from "@/lib/auth";
import { SiteSwitcher } from "@/components/layout/site-switcher";
import { NotificationBell } from "@/components/layout/notification-bell";

type TopBarProps = {
  userName: string;
  role: string;
  isAuthenticated?: boolean;
};

export async function TopBar({ userName, role, isAuthenticated = true }: TopBarProps) {
  return (
    <header className="border-b border-border bg-background-card">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-base font-semibold tracking-tight text-foreground">
            PMIS
          </Link>
          <SiteSwitcher />
          <Link
            href="/dashboard/search"
            className="rounded-md border border-border bg-background-soft px-2 py-1 text-xs text-foreground hover:bg-background-card"
          >
            통합검색
          </Link>
        </div>

        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <NotificationBell />
          <span className="hidden rounded-md bg-background-soft px-2 py-1 md:block">
            {userName}
          </span>
          <span className="rounded-md border border-border bg-background-soft px-2 py-1 uppercase">
            {role}
          </span>
          {isAuthenticated ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
              >
                Logout
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
