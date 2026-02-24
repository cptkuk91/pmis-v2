"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataTable, FormInput, Pagination, StatusBadge } from "@/components/ui";

type DocumentItem = {
  _id: string;
  docNo: string;
  title: string;
  ledgerType: "instruction" | "outbound" | "inbound" | "general";
  direction: "outbound" | "inbound" | "internal";
  status: "draft" | "in_review" | "approved" | "rejected" | "completed";
  senderName: string;
  receiverName: string;
  updatedAt: string;
};

type DocumentResponse = {
  ok: boolean;
  data: DocumentItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type Props = {
  title: string;
  description: string;
  fixedLedger?: "instruction" | "outbound" | "inbound";
  fixedDirection?: "outbound" | "inbound";
  defaultKeyword?: string;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ko-KR");
}

export function DocumentLedgerView({
  title,
  description,
  fixedLedger,
  fixedDirection,
  defaultKeyword = "",
}: Props) {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [keyword, setKeyword] = useState(defaultKeyword);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          status: statusFilter,
        });
        if (fixedLedger) {
          params.set("ledger", fixedLedger);
        }
        if (fixedDirection) {
          params.set("direction", fixedDirection);
        }

        const response = await fetch(`/api/documents?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as DocumentResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "문서 조회 실패");
        }
        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "문서 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [fixedDirection, fixedLedger, keyword, statusFilter],
  );

  useEffect(() => {
    void loadDocuments(1);
  }, [loadDocuments]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-foreground-muted">{description}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="문서번호/제목/내용/발신/수신"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">상태</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="draft">임시저장</option>
            <option value="in_review">검토중</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
            <option value="completed">완료</option>
          </select>
        </label>
        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadDocuments(1)}
            className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
          >
            조회
          </button>
          <Link
            href="/design-docs/documents/wizard/1"
            className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
          >
            문서작성
          </Link>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<DocumentItem>
        columns={[
          { key: "docNo", header: "문서번호", className: "w-40" },
          { key: "title", header: "제목" },
          { key: "senderName", header: "발신", className: "w-24" },
          { key: "receiverName", header: "수신", className: "w-24" },
          {
            key: "status",
            header: "상태",
            className: "w-24",
            render: (value) => <StatusBadge status={value as DocumentItem["status"]} />,
          },
          {
            key: "updatedAt",
            header: "수정일",
            className: "w-32",
            render: (value) => formatDate(String(value)),
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "조회된 문서가 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadDocuments(nextPage)} />
    </section>
  );
}
