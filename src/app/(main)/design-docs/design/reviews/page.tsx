"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination, StatusBadge } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type ReviewItem = {
  _id: string;
  docNo: string;
  drawingNo: string;
  drawingName: string;
  requesterName: string;
  reviewerName: string;
  requestedAt: string;
  decisionStatus: "pending" | "approved" | "rejected";
};

type ReviewResponse = {
  ok: boolean;
  data: ReviewItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

function decisionToBadge(status: ReviewItem["decisionStatus"]) {
  if (status === "approved") {
    return "approved";
  }
  if (status === "rejected") {
    return "rejected";
  }
  return "in_review";
}

export default function DrawingReviewsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);
  const canDecide = useMemo(() => hasMinRole(user.role, "site_admin"), [user.role]);

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [sort, setSort] = useState<"latest" | "oldest" | "doc_asc" | "doc_desc">("latest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [docNo, setDocNo] = useState("");
  const [drawingNo, setDrawingNo] = useState("");
  const [drawingName, setDrawingName] = useState("");
  const [reviewerName, setReviewerName] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadReviews = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          status: statusFilter,
          sort,
        });
        const response = await fetch(`/api/drawing-reviews?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as ReviewResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "도면검토현황 조회 실패");
        }
        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "도면검토현황 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, sort, statusFilter],
  );

  useEffect(() => {
    void loadReviews(1);
  }, [loadReviews]);

  async function handleQuickCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/drawing-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docNo,
          drawingNo,
          drawingName,
          reviewerName,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "검토요청 등록 실패");
      }
      setDocNo("");
      setDrawingNo("");
      setDrawingName("");
      setReviewerName("");
      setMessage("검토요청이 등록되었습니다.");
      await loadReviews(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검토요청 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">도면검토현황</h1>
          <p className="mt-1 text-sm text-foreground-muted">검토요청/결과통보/승인 상태를 관리합니다.</p>
        </div>
        <Link
          href="/design-docs/design/reviews/new/request"
          className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          상세 요청작성
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="문서번호/도면번호/도면명/요청자/검토자"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">상태</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "pending" | "approved" | "rejected")}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="pending">검토중</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">정렬</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as "latest" | "oldest" | "doc_asc" | "doc_desc")}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="doc_asc">문서번호 오름차순</option>
            <option value="doc_desc">문서번호 내림차순</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void loadReviews(1)}
          className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          조회
        </button>
      </div>

      {canWrite ? (
        <form onSubmit={handleQuickCreate} className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_1fr_180px_auto]">
          <FormInput label="문서번호" value={docNo} onChange={(event) => setDocNo(event.target.value)} required />
          <FormInput label="도면번호" value={drawingNo} onChange={(event) => setDrawingNo(event.target.value)} required />
          <FormInput label="도면명" value={drawingName} onChange={(event) => setDrawingName(event.target.value)} required />
          <FormInput label="검토자" value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} />
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
          >
            간편 등록
          </button>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">검토요청 등록은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<ReviewItem>
        columns={[
          { key: "docNo", header: "문서번호", className: "w-32" },
          { key: "drawingNo", header: "도면번호", className: "w-32" },
          { key: "drawingName", header: "도면명" },
          { key: "requesterName", header: "요청자", className: "w-24" },
          { key: "reviewerName", header: "검토자", className: "w-24" },
          {
            key: "decisionStatus",
            header: "상태",
            className: "w-24",
            render: (value) => <StatusBadge status={decisionToBadge(value as ReviewItem["decisionStatus"])} />,
          },
          {
            key: "requestedAt",
            header: "요청일",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          {
            key: "_id",
            header: "작업",
            className: "w-44",
            render: (_, row) => (
              <div className="flex items-center gap-2">
                <Link
                  href={`/design-docs/design/reviews/${row._id}/request`}
                  className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                >
                  요청서
                </Link>
                {canDecide ? (
                  <Link
                    href={`/design-docs/design/reviews/${row._id}/result`}
                    className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                  >
                    결과통보
                  </Link>
                ) : null}
              </div>
            ),
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 검토요청이 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadReviews(nextPage)} />
    </section>
  );
}
