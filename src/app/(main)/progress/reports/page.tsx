"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination, StatusBadge } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type ReportType = "supervision" | "daily" | "weekly";
type Status = "draft" | "in_review" | "approved" | "rejected" | "completed";

type ReportRow = {
  _id: string;
  reportType: ReportType;
  title: string;
  reportDate: string;
  authorName: string;
  progressRate: number;
  status: Status;
};

type ReportResponse = {
  ok: boolean;
  data: ReportRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

const reportTypeLabel: Record<ReportType, string> = {
  supervision: "감리",
  daily: "일보",
  weekly: "주간",
};

export default function ProgressReportsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<ReportRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState<"all" | ReportType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  const [title, setTitle] = useState("");
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [progressRate, setProgressRate] = useState(0);
  const [content, setContent] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          reportType: reportTypeFilter,
          status: statusFilter,
        });

        const response = await fetch(`/api/progress/reports?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as ReportResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "보고서 조회 실패");
        }

        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "보고서 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, reportTypeFilter, statusFilter],
  );

  useEffect(() => {
    void loadData(1);
  }, [loadData]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/progress/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          reportType,
          reportDate,
          progressRate,
          content,
        }),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "보고서 등록 실패");
      }

      setTitle("");
      setReportType("daily");
      setReportDate(new Date().toISOString().slice(0, 10));
      setProgressRate(0);
      setContent("");
      setMessage("보고서가 등록되었습니다.");
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "보고서 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">보고서 (감리/일보/주간)</h1>
        <p className="mt-1 text-sm text-foreground-muted">현장 보고서를 등록하고 상태별로 조회합니다.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="제목/내용/작성자"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">유형</span>
          <select
            value={reportTypeFilter}
            onChange={(event) => setReportTypeFilter(event.target.value as "all" | ReportType)}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="supervision">감리</option>
            <option value="daily">일보</option>
            <option value="weekly">주간</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">상태</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | Status)}
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
        <button
          type="button"
          onClick={() => void loadData(1)}
          className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          조회
        </button>
      </div>

      {canWrite ? (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-background-soft p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormInput
              label="제목"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 2월 4주차 공정 주간보고"
              required
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">유형</span>
              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value as ReportType)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="supervision">감리</option>
                <option value="daily">일보</option>
                <option value="weekly">주간</option>
              </select>
            </label>
            <FormInput
              label="보고일"
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value)}
              required
            />
            <FormInput
              label="진도율(%)"
              type="number"
              min={0}
              max={100}
              value={String(progressRate)}
              onChange={(event) => setProgressRate(Number(event.target.value || "0"))}
            />
          </div>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">내용</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="공정 현황, 이슈, 조치 사항"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              보고서 등록
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">보고서 등록은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<ReportRow>
        columns={[
          {
            key: "reportDate",
            header: "보고일",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          {
            key: "reportType",
            header: "유형",
            className: "w-20",
            render: (value) => reportTypeLabel[value as ReportType],
          },
          { key: "title", header: "제목" },
          { key: "authorName", header: "작성자", className: "w-24" },
          {
            key: "progressRate",
            header: "진도율",
            className: "w-20 text-right",
            render: (value) => `${Number(value).toFixed(1)}%`,
          },
          {
            key: "status",
            header: "상태",
            className: "w-24",
            render: (value) => <StatusBadge status={value as Status} />,
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 보고서가 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadData(nextPage)} />
    </section>
  );
}
