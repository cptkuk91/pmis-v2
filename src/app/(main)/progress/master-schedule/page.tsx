"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import {
  DEFAULT_PROGRESS_SCHEDULE_CATEGORY,
  PROGRESS_SCHEDULE_CATEGORIES,
  isProgressScheduleCategory,
  type ProgressScheduleCategory,
} from "@/lib/progress-schedule-category";

type ScheduleRow = {
  _id: string;
  taskCode: string;
  taskName: string;
  category: ProgressScheduleCategory | string;
  plannedStart: string;
  plannedEnd: string;
  plannedProgress: number;
  actualProgress: number;
  sortOrder: number;
  actions?: string;
};

type ScheduleResponse = {
  ok: boolean;
  data: ScheduleRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type NextTaskCodeResponse = {
  ok: boolean;
  data?: { taskCode: string };
  error?: string;
};

type MutationResponse = {
  ok: boolean;
  error?: string;
};

type DeleteTarget = {
  _id: string;
  taskCode: string;
  taskName: string;
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
  const pathname = usePathname();
  const isComparisonActive = pathname.startsWith("/progress/comparison");
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<ScheduleRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ProgressScheduleCategory>("all");

  const [taskCode, setTaskCode] = useState("");
  const [taskName, setTaskName] = useState("");
  const [category, setCategory] = useState<ProgressScheduleCategory>(DEFAULT_PROGRESS_SCHEDULE_CATEGORY);
  const [plannedStart, setPlannedStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [plannedEnd, setPlannedEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [plannedProgress, setPlannedProgress] = useState(0);
  const [actualProgress, setActualProgress] = useState(0);
  const [sortOrder, setSortOrder] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTaskCode, setEditTaskCode] = useState("");
  const [editTaskName, setEditTaskName] = useState("");
  const [editCategory, setEditCategory] = useState<ProgressScheduleCategory>(DEFAULT_PROGRESS_SCHEDULE_CATEGORY);
  const [editPlannedStart, setEditPlannedStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [editPlannedEnd, setEditPlannedEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [editPlannedProgress, setEditPlannedProgress] = useState(0);
  const [editActualProgress, setEditActualProgress] = useState(0);
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [editOriginalCategory, setEditOriginalCategory] = useState("");
  const [editOriginalTaskCode, setEditOriginalTaskCode] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [taskCodeLoadingTarget, setTaskCodeLoadingTarget] = useState<"create" | "edit" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isTaskCodeLoading = taskCodeLoadingTarget === "create";
  const isEditTaskCodeLoading = taskCodeLoadingTarget === "edit";

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

  const loadNextTaskCode = useCallback(
    async (
      nextCategory: ProgressScheduleCategory,
      options: {
        target?: "create" | "edit";
        excludeItemId?: string;
      } = {},
    ) => {
      if (!canWrite) {
        return;
      }

      const target = options.target ?? "create";
      setTaskCodeLoadingTarget(target);
      try {
        const params = new URLSearchParams({ category: nextCategory });
        if (options.excludeItemId) {
          params.set("excludeItemId", options.excludeItemId);
        }
        const response = await fetch(`/api/progress/schedule/next-task-code?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as NextTaskCodeResponse;
        if (!result.ok || !result.data) {
          throw new Error(result.error ?? "작업코드 조회 실패");
        }

        if (target === "edit") {
          setEditTaskCode(result.data.taskCode);
        } else {
          setTaskCode(result.data.taskCode);
        }
      } catch (err) {
        if (target === "edit") {
          setEditTaskCode("");
        } else {
          setTaskCode("");
        }
        setError(err instanceof Error ? err.message : "작업코드 조회 실패");
      } finally {
        setTaskCodeLoadingTarget(null);
      }
    },
    [canWrite],
  );

  useEffect(() => {
    if (!canWrite) {
      return;
    }
    void loadNextTaskCode(category);
  }, [canWrite, category, loadNextTaskCode]);

  function handleOpenEditModal(row: ScheduleRow) {
    const rawCategory = String(row.category ?? "");
    const normalizedCategory: ProgressScheduleCategory = isProgressScheduleCategory(rawCategory)
      ? rawCategory
      : DEFAULT_PROGRESS_SCHEDULE_CATEGORY;

    setEditingId(row._id);
    setEditTaskCode(row.taskCode ?? "");
    setEditTaskName(row.taskName ?? "");
    setEditCategory(normalizedCategory);
    setEditPlannedStart(row.plannedStart ? String(row.plannedStart).slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditPlannedEnd(row.plannedEnd ? String(row.plannedEnd).slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditPlannedProgress(Number(row.plannedProgress ?? 0));
    setEditActualProgress(Number(row.actualProgress ?? 0));
    setEditSortOrder(Number(row.sortOrder ?? 0));
    setEditOriginalCategory(String(row.category ?? ""));
    setEditOriginalTaskCode(row.taskCode ?? "");
    setError(null);
    setMessage(null);
  }

  function handleCloseEditModal() {
    if (isUpdating || isEditTaskCodeLoading) {
      return;
    }

    setEditingId(null);
    setEditTaskCode("");
    setEditTaskName("");
    setEditCategory(DEFAULT_PROGRESS_SCHEDULE_CATEGORY);
    setEditPlannedStart(new Date().toISOString().slice(0, 10));
    setEditPlannedEnd(new Date().toISOString().slice(0, 10));
    setEditPlannedProgress(0);
    setEditActualProgress(0);
    setEditSortOrder(0);
    setEditOriginalCategory("");
    setEditOriginalTaskCode("");
  }

  function handleOpenDeleteModal(row: ScheduleRow) {
    setDeleteTarget({
      _id: row._id,
      taskCode: row.taskCode,
      taskName: row.taskName,
    });
    setError(null);
    setMessage(null);
  }

  function handleCloseDeleteModal() {
    if (deletingId) {
      return;
    }
    setDeleteTarget(null);
  }

  function handleEditCategoryChange(nextCategory: ProgressScheduleCategory) {
    setEditCategory(nextCategory);

    if (nextCategory === editOriginalCategory) {
      setEditTaskCode(editOriginalTaskCode);
      return;
    }

    if (!editingId) {
      return;
    }

    void loadNextTaskCode(nextCategory, {
      target: "edit",
      excludeItemId: editingId,
    });
  }

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
      setCategory(DEFAULT_PROGRESS_SCHEDULE_CATEGORY);
      setPlannedStart(new Date().toISOString().slice(0, 10));
      setPlannedEnd(new Date().toISOString().slice(0, 10));
      setPlannedProgress(0);
      setActualProgress(0);
      setSortOrder(0);
      setMessage("공정 항목이 등록되었습니다.");
      await loadNextTaskCode(DEFAULT_PROGRESS_SCHEDULE_CATEGORY);
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공정표 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) {
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/progress/schedule/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: editTaskName,
          category: editCategory,
          plannedStart: editPlannedStart,
          plannedEnd: editPlannedEnd,
          plannedProgress: clampProgress(editPlannedProgress),
          actualProgress: clampProgress(editActualProgress),
          sortOrder: editSortOrder,
        }),
      });

      const result = (await response.json()) as MutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "공정 항목 수정 실패");
      }

      setEditingId(null);
      setEditTaskCode("");
      setEditTaskName("");
      setEditCategory(DEFAULT_PROGRESS_SCHEDULE_CATEGORY);
      setEditPlannedStart(new Date().toISOString().slice(0, 10));
      setEditPlannedEnd(new Date().toISOString().slice(0, 10));
      setEditPlannedProgress(0);
      setEditActualProgress(0);
      setEditSortOrder(0);
      setEditOriginalCategory("");
      setEditOriginalTaskCode("");
      setMessage("공정 항목이 수정되었습니다.");
      await loadData(page);
      await loadNextTaskCode(category);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공정 항목 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/progress/schedule/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as MutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "공정 항목 삭제 실패");
      }

      setDeleteTarget(null);
      setMessage("공정 항목이 삭제되었습니다.");
      await loadData(1);
      await loadNextTaskCode(category);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공정 항목 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo<DataTableColumn<ScheduleRow>[]>(() => {
    const baseColumns: DataTableColumn<ScheduleRow>[] = [
      { key: "category", header: "분류", className: "w-36" },
      { key: "taskCode", header: "작업코드", className: "w-28" },
      { key: "taskName", header: "작업명", className: "hidden" },
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
    ];

    if (!canWrite) {
      return baseColumns;
    }

    return [
      ...baseColumns,
      {
        key: "actions",
        header: "관리",
        className: "w-32",
        render: (_value, row) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleOpenEditModal(row)}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => handleOpenDeleteModal(row)}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        ),
      },
    ];
  }, [canWrite, handleOpenDeleteModal, handleOpenEditModal]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">공정 추적</h1>
        <p className="mt-1 text-sm text-foreground-muted">공정 항목의 계획/실적 진도율을 입력하고 지연 여부를 확인합니다.</p>
      </header>

      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-soft p-1">
        <Link
          href="/progress/master-schedule"
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            !isComparisonActive
              ? "bg-[#ecebe8] font-medium text-foreground"
              : "text-foreground-muted hover:bg-background-card hover:text-foreground"
          }`}
        >
          공정표
        </Link>
        <Link
          href="/progress/comparison"
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            isComparisonActive
              ? "bg-[#ecebe8] font-medium text-foreground"
              : "text-foreground-muted hover:bg-background-card hover:text-foreground"
          }`}
        >
          진도 분석
        </Link>
      </nav>

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
            onChange={(event) => setCategoryFilter(event.target.value as "all" | ProgressScheduleCategory)}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            {PROGRESS_SCHEDULE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
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
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">분류</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as ProgressScheduleCategory)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {PROGRESS_SCHEDULE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1">
              <span className="block text-sm font-medium text-foreground">작업코드</span>
              <input
                readOnly
                value={isTaskCodeLoading ? "채번 중..." : taskCode}
                className="h-9 w-full rounded-md border border-border bg-background-soft px-3 text-sm text-foreground outline-none"
              />
              <p className="text-xs text-foreground-muted">분류별로 자동 채번됩니다.</p>
            </div>
            <FormInput
              label="작업명"
              value={taskName}
              onChange={(event) => setTaskName(event.target.value)}
              placeholder="예: 4동 저수조 계단"
              required
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
              disabled={isSubmitting || isTaskCodeLoading || !taskCode}
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
                    <p className="truncate text-xs font-medium text-foreground">{row.taskCode}</p>
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
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 공정 항목이 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadData(nextPage)} />

      <Modal open={Boolean(editingId)} title="공정 항목 수정" onClose={handleCloseEditModal}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            void handleUpdate(event);
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">분류</span>
              <select
                value={editCategory}
                onChange={(event) => handleEditCategoryChange(event.target.value as ProgressScheduleCategory)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {PROGRESS_SCHEDULE_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1">
              <span className="block text-sm font-medium text-foreground">작업코드</span>
              <input
                readOnly
                value={isEditTaskCodeLoading ? "채번 중..." : editTaskCode}
                className="h-9 w-full rounded-md border border-border bg-background-soft px-3 text-sm text-foreground outline-none"
              />
              <p className="text-xs text-foreground-muted">분류가 바뀌면 작업코드도 자동으로 다시 생성됩니다.</p>
            </div>
            <FormInput
              label="작업명"
              value={editTaskName}
              onChange={(event) => setEditTaskName(event.target.value)}
              placeholder="예: 4동 저수조 계단"
              required
            />
            <FormInput
              label="정렬순서"
              type="number"
              value={String(editSortOrder)}
              onChange={(event) => setEditSortOrder(Number(event.target.value || "0"))}
            />
            <FormInput
              label="계획시작"
              type="date"
              value={editPlannedStart}
              onChange={(event) => setEditPlannedStart(event.target.value)}
              required
            />
            <FormInput
              label="계획종료"
              type="date"
              value={editPlannedEnd}
              onChange={(event) => setEditPlannedEnd(event.target.value)}
              required
            />
            <FormInput
              label="계획진도율(%)"
              type="number"
              min={0}
              max={100}
              value={String(editPlannedProgress)}
              onChange={(event) => setEditPlannedProgress(Number(event.target.value || "0"))}
            />
            <FormInput
              label="실적진도율(%)"
              type="number"
              min={0}
              max={100}
              value={String(editActualProgress)}
              onChange={(event) => setEditActualProgress(Number(event.target.value || "0"))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseEditModal}
              disabled={isUpdating || isEditTaskCodeLoading}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isUpdating || isEditTaskCodeLoading || !editTaskCode}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
            >
              {isUpdating ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="공정 항목 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <span className="font-medium">{deleteTarget?.taskCode ?? "-"}</span>
            {" · "}
            {deleteTarget?.taskName ?? "-"}
            {" 항목을 삭제하시겠습니까?"}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseDeleteModal}
              disabled={Boolean(deletingId)}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={Boolean(deletingId)}
              className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
            >
              {deletingId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
