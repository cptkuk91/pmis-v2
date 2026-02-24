"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SupportFaqPage from "./faq/page";
import SupportTicketsPage from "./tickets/page";

type SupportTab = "faq" | "tickets";

function parseTab(value: string | null): SupportTab {
  return value === "faq" ? "faq" : "tickets";
}

export default function SupportUnifiedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTabFromQuery = parseTab(searchParams.get("tab"));
  const [tab, setTab] = useState<SupportTab>(currentTabFromQuery);

  useEffect(() => {
    setTab(currentTabFromQuery);
  }, [currentTabFromQuery]);

  function handleChangeTab(nextTab: SupportTab) {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`/system-admin/support?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-card p-1">
        <button
          type="button"
          onClick={() => handleChangeTab("tickets")}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            tab === "tickets"
              ? "bg-[#ecebe8] font-medium text-foreground"
              : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
          }`}
        >
          문의/문제신고
        </button>
        <button
          type="button"
          onClick={() => handleChangeTab("faq")}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            tab === "faq"
              ? "bg-[#ecebe8] font-medium text-foreground"
              : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
          }`}
        >
          FAQ
        </button>
      </nav>

      {tab === "faq" ? <SupportFaqPage /> : <SupportTicketsPage />}
    </div>
  );
}
