"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { qaMenuGroups } from "./menu-config";

export default function QaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeGroup =
    qaMenuGroups.find((group) =>
      group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/")),
    ) ?? qaMenuGroups[0];

  return (
    <div className="space-y-4">
      <nav className="overflow-x-auto rounded-lg border border-border bg-background-card">
        <div className="flex min-w-max gap-1 p-1">
          {qaMenuGroups.map((group) => {
            const isActive = group.id === activeGroup.id;
            return (
              <Link
                key={group.id}
                href={group.items[0].href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[#ecebe8] font-medium text-foreground"
                    : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
                }`}
              >
                {group.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <nav className="overflow-x-auto rounded-lg border border-border bg-background-card">
        <div className="flex min-w-max gap-1 p-1">
          {activeGroup.items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[#ecebe8] font-medium text-foreground"
                    : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {children}
    </div>
  );
}
