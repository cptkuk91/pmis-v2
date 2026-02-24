"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui";

type PendingDocItem = {
  _id: string;
  docNo: string;
  title: string;
  status: string;
  updatedAt: string | null;
};

export default function DashboardPendingDocsPage() {
  const [items, setItems] = useState<PendingDocItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/documents/pending", { cache: "no-store" });
        const result = (await response.json()) as {
          ok: boolean;
          data: PendingDocItem[];
          error?: string;
        };
        if (!result.ok) {
          throw new Error(result.error ?? "미결문서 조회 실패");
        }
        setItems(result.data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "미결문서 조회 실패");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">미결문서</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Phase 2 1팀: 결재 대기 문서 조회 API 연동
        </p>
      </header>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<PendingDocItem>
        columns={[
          { key: "docNo", header: "문서번호", className: "w-40" },
          { key: "title", header: "제목" },
          { key: "status", header: "상태", className: "w-32" },
          {
            key: "updatedAt",
            header: "수정일",
            className: "w-32",
            render: (value) =>
              value ? new Date(String(value)).toLocaleDateString("ko-KR") : "-",
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "미결문서가 없습니다."}
      />
    </section>
  );
}
