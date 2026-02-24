"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput } from "@/components/ui";

type UnifiedSource = "document" | "drawing" | "issue" | "library";

type UnifiedSearchItem = {
  id: string;
  source: UnifiedSource;
  code: string;
  title: string;
  summary: string;
  status: string;
  updatedAt: string;
  href: string;
};

type UnifiedSearchResponse = {
  ok: boolean;
  data: {
    query: string;
    counts: {
      documents: number;
      drawings: number;
      issues: number;
      library: number;
      total: number;
    };
    groups: {
      documents: UnifiedSearchItem[];
      drawings: UnifiedSearchItem[];
      issues: UnifiedSearchItem[];
      library: UnifiedSearchItem[];
    };
    items: UnifiedSearchItem[];
  };
  error?: string;
};

const sourceLabel: Record<UnifiedSource, string> = {
  document: "문서",
  drawing: "도면",
  issue: "ISSUE",
  library: "자료실",
};

export default function UnifiedSearchPage() {
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | UnifiedSource>("all");
  const [counts, setCounts] = useState({ documents: 0, drawings: 0, issues: 0, library: 0, total: 0 });
  const [items, setItems] = useState<UnifiedSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (sourceFilter === "all") {
      return items;
    }
    return items.filter((item) => item.source === sourceFilter);
  }, [items, sourceFilter]);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: trimmed, limit: "12" });
      const response = await fetch(`/api/search/unified?${params.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as UnifiedSearchResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "통합 검색 실패");
      }

      setCounts(result.data.counts);
      setItems(result.data.items);
    } catch (err) {
      setCounts({ documents: 0, drawings: 0, issues: 0, library: 0, total: 0 });
      setItems([]);
      setError(err instanceof Error ? err.message : "통합 검색 실패");
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
      setCounts({ documents: 0, drawings: 0, issues: 0, library: 0, total: 0 });
      setItems([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void runSearch();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">통합 문서 검색</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          문서/도면/ISSUE/자료실 데이터를 한 번에 검색합니다.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]">
        <FormInput
          label="검색어"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="문서번호, 도면명, 이슈 제목, 자료실 제목"
        />

        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">대상</span>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as "all" | UnifiedSource)}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="document">문서</option>
            <option value="drawing">도면</option>
            <option value="issue">ISSUE</option>
            <option value="library">자료실</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => void runSearch()}
          className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          검색
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">전체</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{counts.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">문서</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{counts.documents}</p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">도면</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{counts.drawings}</p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">ISSUE</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{counts.issues}</p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">자료실</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{counts.library}</p>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<UnifiedSearchItem>
        columns={[
          {
            key: "source",
            header: "구분",
            className: "w-20",
            render: (value) => sourceLabel[value as UnifiedSource],
          },
          { key: "code", header: "코드", className: "w-32" },
          { key: "title", header: "제목" },
          { key: "summary", header: "요약" },
          { key: "status", header: "상태", className: "w-24" },
          {
            key: "updatedAt",
            header: "수정일",
            className: "w-32",
            render: (value) => {
              const date = new Date(String(value));
              if (Number.isNaN(date.getTime())) {
                return "-";
              }
              return date.toLocaleDateString("ko-KR");
            },
          },
          {
            key: "id",
            header: "이동",
            className: "w-20",
            render: (_, row) => (
              <Link
                href={row.href}
                className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
              >
                열기
              </Link>
            ),
          },
        ]}
        data={filteredItems}
        rowKey={(row) => `${row.source}-${row.id}`}
        emptyMessage={isLoading ? "검색 중..." : "검색 결과가 없습니다."}
      />
    </section>
  );
}
