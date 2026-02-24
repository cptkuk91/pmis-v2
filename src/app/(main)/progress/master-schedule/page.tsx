"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type ScheduleRow = {
  _id: string;
  taskCode: string;
  taskName: string;
  category: string;
  plannedStart: string;
  plannedEnd: string;
  plannedProgress: number;
  actualProgress: number;
  sortOrder: number;
};

type ScheduleResponse = {
  ok: boolean;
  data: ScheduleRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toStartOfDay(rawValue: string): Date {
  const date = new Date(rawValue);
  date.setHours(0, 0, 0, 0);
  return date;
}

function diffDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS);
}

export default function MasterSchedulePage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<ScheduleRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [taskCode, setTaskCode] = useState("");
  const [taskName, setTaskName] = useState("");
  const [category, setCategory] = useState("공정");
  const [plannedStart, setPlannedStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [plannedEnd, setPlannedEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [plannedProgress, setPlannedProgress] = useState(0);
  const [actualProgress, setActualProgress] = useState(0);
  const [sortOrder, setSortOrder] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const ganttRows = useMemo(() => {
    return items
      .map((item) => {
        const start = toStartOfDay(item.plannedStart);
        const end = toStartOfDay(item.plannedEnd);
        return {
          ...item,
          start,
          end,
        };
      })
      .filter((item) => !Number.isNaN(item.start.getTime()) && !Number.isNaN(item.end.getTime()))
      .sort((a, b) => a.start.getTime() - b.start.getTime() || a.sortOrder - b.sortOrder);
  }, [items]);

  const ganttRange = useMemo(() => {
    if (ganttRows.length === 0) {
      return null;
    }
    const starts = ganttRows.map((row) => row.start.getTime());
    const ends = ganttRows.map((row) => row.end.getTime());
    const timelineStart = new Date(Math.min(...starts));
    const timelineEnd = new Date(Math.max(...ends));
    const totalDays = Math.max(1, diffDays(timelineStart, timelineEnd) + 1);
    const today = toStartOfDay(new Date().toISOString());
    const todayOffset = diffDays(timelineStart, today);
    const todayLeftPercent = Math.min(100, Math.max(0, (todayOffset / totalDays) * 100));

    return { timelineStart, timelineEnd, totalDays, todayLeftPercent };
  }, [ganttRows]);

  const loadData = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "20",
          q: keyword,
          category: categoryFilter,
        });

        const response = await fetch(`/api/progress/schedule?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as ScheduleResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "공정표 조회 실패");
        }

        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "공정표 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, categoryFilter],
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
      const response = await fetch("/api/progress/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskCode,
          taskName,
          category,
          plannedStart,
          plannedEnd,
          plannedProgress: clampProgress(plannedProgress),
          actualProgress: clampProgress(actualProgress),
          sortOrder,
        }),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "공정표 등록 실패");
      }

      setTaskCode("");
      setTaskName("");
      setCategory("공정");
      setPlannedStart(new Date().toISOString().slice(0, 10));
      setPlannedEnd(new Date().toISOString().slice(0, 10));
      setPlannedProgress(0);
      setActualProgress(0);
      setSortOrder(0);
      setMessage("공정 항목이 등록되었습니다.");
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공정표 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Master/주간 공정표</h1>
        <p className="mt-1 text-sm text-foreground-muted">공정 항목의 계획/실적 진도율을 입력하고 지연 여부를 확인합니다.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="작업코드/작업명/분류"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">분류</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="공정">공정</option>
            <option value="골조">골조</option>
            <option value="마감">마감</option>
            <option value="설비">설비</option>
            <option value="전기">전기</option>
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
              label="작업코드"
              value={taskCode}
              onChange={(event) => setTaskCode(event.target.value)}
              placeholder="예: S-311"
              required
            />
            <FormInput
              label="작업명"
              value={taskName}
              onChange={(event) => setTaskName(event.target.value)}
              placeholder="예: 4동 저수조 계단"
              required
            />
            <FormInput
              label="분류"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="예: 골조"
            />
            <FormInput
              label="정렬순서"
              type="number"
              value={String(sortOrder)}
              onChange={(event) => setSortOrder(Number(event.target.value || "0"))}
            />
            <FormInput
              label="계획시작"
              type="date"
              value={plannedStart}
              onChange={(event) => setPlannedStart(event.target.value)}
              required
            />
            <FormInput
              label="계획종료"
              type="date"
              value={plannedEnd}
              onChange={(event) => setPlannedEnd(event.target.value)}
              required
            />
            <FormInput
              label="계획진도율(%)"
              type="number"
              min={0}
              max={100}
              value={String(plannedProgress)}
              onChange={(event) => setPlannedProgress(Number(event.target.value || "0"))}
            />
            <FormInput
              label="실적진도율(%)"
              type="number"
              min={0}
              max={100}
              value={String(actualProgress)}
              onChange={(event) => setActualProgress(Number(event.target.value || "0"))}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              공정 항목 등록
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">공정 항목 등록은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="rounded-xl border border-border bg-background-soft p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">GANTT 바차트</h2>
          {ganttRange ? (
            <p className="text-xs text-foreground-muted">
              {ganttRange.timelineStart.toLocaleDateString("ko-KR")} ~{" "}
              {ganttRange.timelineEnd.toLocaleDateString("ko-KR")}
            </p>
          ) : null}
        </header>

        {!ganttRange || ganttRows.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">
            {isLoading ? "불러오는 중..." : "공정 항목이 없어 GANTT를 표시할 수 없습니다."}
          </p>
        ) : (
          <div className="mt-3 space-y-2 overflow-x-auto">
            {ganttRows.slice(0, 30).map((row) => {
              const startOffset = Math.max(0, diffDays(ganttRange.timelineStart, row.start));
              const durationDays = Math.max(1, diffDays(row.start, row.end) + 1);
              const leftPercent = (startOffset / ganttRange.totalDays) * 100;
              const widthPercent = (durationDays / ganttRange.totalDays) * 100;
              const delayed = row.actualProgress < row.plannedProgress;
              const actualFill = Math.max(0, Math.min(100, row.actualProgress));

              return (
                <div key={row._id} className="grid min-w-[880px] grid-cols-[180px_1fr] items-center gap-2">
                  <div className="space-y-0.5">
                    <p className="truncate text-xs font-medium text-foreground">
                      {row.taskCode} · {row.taskName}
                    </p>
                    <p className="text-[11px] text-foreground-muted">
                      {row.plannedProgress.toFixed(1)}% / {row.actualProgress.toFixed(1)}%
                    </p>
                  </div>
                  <div className="relative h-9 rounded-md border border-border bg-background-card">
                    <div
                      className="absolute inset-y-1 rounded bg-primary/25"
                      style={{
                        left: `${leftPercent}%`,
                        width: `${Math.max(widthPercent, 1)}%`,
                      }}
                    />
                    <div
                      className={`absolute inset-y-1 rounded ${delayed ? "bg-warning/70" : "bg-success/70"}`}
                      style={{
                        left: `${leftPercent}%`,
                        width: `${Math.max((widthPercent * actualFill) / 100, 1)}%`,
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-px bg-danger/80"
                      style={{ left: `${ganttRange.todayLeftPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <DataTable<ScheduleRow>
        columns={[
          { key: "taskCode", header: "작업코드", className: "w-28" },
          { key: "taskName", header: "작업명" },
          { key: "category", header: "분류", className: "w-20" },
          {
            key: "plannedStart",
            header: "계획시작",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          {
            key: "plannedEnd",
            header: "계획종료",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          {
            key: "plannedProgress",
            header: "계획",
            className: "w-20 text-right",
            render: (value) => `${Number(value).toFixed(1)}%`,
          },
          {
            key: "actualProgress",
            header: "실적",
            className: "w-20 text-right",
            render: (value) => `${Number(value).toFixed(1)}%`,
          },
          {
            key: "_id",
            header: "진도차",
            className: "w-40",
            render: (_, row) => {
              const gap = Number((row.actualProgress - row.plannedProgress).toFixed(1));
              const tone = gap >= 0 ? "text-success" : "text-danger";
              return <span className={`text-sm font-medium ${tone}`}>{gap > 0 ? `+${gap}` : gap}%</span>;
            },
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 공정 항목이 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadData(nextPage)} />
    </section>
  );
}
