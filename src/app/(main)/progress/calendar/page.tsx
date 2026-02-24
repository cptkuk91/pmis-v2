"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type CalendarEventRow = {
  _id: string;
  title: string;
  category: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  description: string;
  color: string;
};

type CalendarResponse = {
  ok: boolean;
  data: CalendarEventRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ProgressCalendarPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<CalendarEventRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isAllDay, setIsAllDay] = useState(true);
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#2f76d2");

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
          limit: "20",
          q: keyword,
          month,
          category: categoryFilter,
        });

        const response = await fetch(`/api/progress/calendar?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as CalendarResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "캘린더 조회 실패");
        }

        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "캘린더 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [categoryFilter, keyword, month],
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
      const response = await fetch("/api/progress/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          startDate,
          endDate,
          isAllDay,
          description,
          color,
        }),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "일정 등록 실패");
      }

      setTitle("");
      setCategory("general");
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate(new Date().toISOString().slice(0, 10));
      setIsAllDay(true);
      setDescription("");
      setColor("#2f76d2");
      setMessage("일정이 등록되었습니다.");
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "일정 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Project Calendar</h1>
        <p className="mt-1 text-sm text-foreground-muted">월별 공정 이벤트와 현장 일정을 조회/등록합니다.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="제목/분류/설명"
        />
        <FormInput
          label="대상월"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">분류</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="general">일반</option>
            <option value="milestone">마일스톤</option>
            <option value="inspection">점검</option>
            <option value="meeting">회의</option>
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
              label="일정명"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="예: 4동 골조 마감 점검"
              required
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">분류</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="general">일반</option>
                <option value="milestone">마일스톤</option>
                <option value="inspection">점검</option>
                <option value="meeting">회의</option>
              </select>
            </label>
            <FormInput
              label="시작일"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
            <FormInput
              label="종료일"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[120px_180px_1fr]">
            <label className="mt-7 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(event) => setIsAllDay(event.target.checked)}
                className="size-4 rounded border-border"
              />
              종일 일정
            </label>
            <FormInput
              label="색상"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">설명</span>
              <textarea
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              일정 등록
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">일정 등록은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<CalendarEventRow>
        columns={[
          {
            key: "title",
            header: "일정",
            render: (value, row) => (
              <div className="flex items-center gap-2">
                <span className="inline-block size-2 rounded-full" style={{ backgroundColor: row.color }} />
                <span>{String(value)}</span>
              </div>
            ),
          },
          { key: "category", header: "분류", className: "w-24" },
          {
            key: "startDate",
            header: "시작",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          {
            key: "endDate",
            header: "종료",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          {
            key: "isAllDay",
            header: "종일",
            className: "w-16 text-center",
            render: (value) => (value ? "Y" : "N"),
          },
          { key: "description", header: "설명" },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 일정이 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadData(nextPage)} />
    </section>
  );
}
