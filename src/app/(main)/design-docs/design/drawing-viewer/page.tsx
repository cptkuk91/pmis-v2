"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataTable, Pagination, StatusBadge } from "@/components/ui";

type DrawingRow = {
  _id: string;
  drawingNo: string;
  drawingName: string;
  discipline: string;
  location: string;
  status: "draft" | "in_review" | "approved" | "rejected" | "completed";
};

type DrawingResponse = {
  ok: boolean;
  data: DrawingRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type ExternalLinkItem = {
  _id: string;
  name: string;
  url: string;
  description?: string;
};

type ExternalLinkResponse = {
  ok: boolean;
  data: ExternalLinkItem[];
};

export default function DrawingViewerIntegrationPage() {
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [rows, setRows] = useState<DrawingRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawingViewerUrl, setDrawingViewerUrl] = useState("https://drawing-viewer.example.com");

  const load = useCallback(async (nextPage: number, query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "10",
        q: query,
      });
      const response = await fetch(`/api/drawings?${params.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as DrawingResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "도면 조회 실패");
      }
      setRows(result.data);
      setPage(result.meta?.page ?? 1);
      setTotalPages(result.meta?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "도면 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1, searchKeyword);
  }, [searchKeyword, load]);

  useEffect(() => {
    const loadLinks = async () => {
      try {
        const response = await fetch("/api/system/external-links?category=general", {
          cache: "no-store",
        });
        const result = (await response.json()) as ExternalLinkResponse;
        if (!result.ok) return;
        const drawingViewerLink = result.data.find(
          (item) => item.name === "도면 열람 시스템" || item.description?.includes("도면"),
        );
        if (drawingViewerLink?.url) {
          setDrawingViewerUrl(drawingViewerLink.url);
        }
      } catch {
        // no-op
      }
    };
    void loadLinks();
  }, []);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">도면 열람 시스템</h1>
        <p className="text-sm text-foreground-muted">
          PMIS 도면 검색 결과를 확인하고 도면 열람 화면으로 바로 이동합니다.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link
          href="/design-docs/design/drawings"
          className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
        >
          PMIS 도면관리로 이동
        </Link>
        <a
          href={drawingViewerUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
        >
          도면 열람 시스템 (새 창)
        </a>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="도면번호/도면명/위치 검색"
          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground sm:max-w-md"
        />
        <button
          type="button"
          onClick={() => setSearchKeyword(keyword.trim())}
          className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background"
        >
          조회
        </button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<DrawingRow>
        columns={[
          { key: "drawingNo", header: "도면번호", className: "w-28" },
          { key: "drawingName", header: "도면명" },
          { key: "discipline", header: "기술구분", className: "w-24" },
          { key: "location", header: "위치", className: "w-28" },
          {
            key: "status",
            header: "상태",
            className: "w-24",
            render: (value) => <StatusBadge status={value as DrawingRow["status"]} />,
          },
          {
            key: "_id",
            header: "열람",
            className: "w-24",
            render: (_value, row) => (
              <a
                href={`${drawingViewerUrl}?q=${encodeURIComponent(row.drawingNo)}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                도면 열람
              </a>
            ),
          },
        ]}
        data={rows}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "조회 결과가 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void load(nextPage, searchKeyword)} />
    </section>
  );
}
