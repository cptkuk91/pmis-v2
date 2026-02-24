"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";

type FaqItem = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

type FaqResponse = {
  ok: boolean;
  data: FaqItem[];
  error?: string;
};

export default function SupportFaqPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const response = await fetch("/api/system/support/faq", { cache: "no-store" });
        const result = (await response.json()) as FaqResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "FAQ 조회 실패");
        }
        setItems(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "FAQ 조회 실패");
      }
    };
    void load();
  }, []);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Support FAQ</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            자주 묻는 질문과 해결 가이드를 확인합니다.
          </p>
        </div>
        <Link
          href="/system-admin/support?tab=tickets"
          className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
        >
          문의/문제신고 작성
        </Link>
      </header>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded-md border border-border bg-background-soft px-3 py-6 text-center text-sm text-foreground-muted">
            등록된 FAQ가 없습니다.
          </p>
        ) : (
          items.map((item) => (
            <details key={item.id} className="rounded-md border border-border bg-background-soft p-3">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground">
                <Badge tone="info">{item.category}</Badge>
                <span>{item.question}</span>
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground-muted">{item.answer}</p>
            </details>
          ))
        )}
      </div>
    </section>
  );
}
