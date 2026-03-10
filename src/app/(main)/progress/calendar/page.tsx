"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { DataTable, FormInput, Modal, Pagination } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import {
  PROGRESS_CALENDAR_CATEGORY_META,
  PROGRESS_CALENDAR_CATEGORY_ORDER,
  normalizeProgressCalendarCategory,
  type ProgressCalendarCategory,
} from "@/lib/progress-calendar-category";

type CalendarEventRow = {
  _id: string;
  title: string;
  category: ProgressCalendarCategory | string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  description: string;
  color?: string;
  actions?: string;
};

type CalendarResponse = {
  ok: boolean;
  data: CalendarEventRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type MutationResponse = {
  ok: boolean;
  error?: string;
};

type CalendarDrawerMode = "create" | "view" | "edit";

type DeleteTarget = {
  _id: string;
  title: string;
};

type CalendarCategoryFilter = "all" | ProgressCalendarCategory;

type CalendarFormState = {
  title: string;
  category: ProgressCalendarCategory;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  description: string;
};

type CalendarDay = {
  key: string;
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_CALENDAR_ITEMS = 200;
const MAX_DAY_CHIPS = 3;
const MONTH_FORMATTER = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" });
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" });

function padNumber(value: number): string {
  return String(value).padStart(2, "0");
}

function getTodayDateInputValue(): string {
  return toDateKey(new Date());
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function getMonthValue(date: Date): string {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;
}

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMonthInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftMonth(value: string, amount: number): string {
  const base = parseMonthInput(value) ?? new Date();
  return getMonthValue(new Date(base.getFullYear(), base.getMonth() + amount, 1));
}

function formatMonthLabel(value: string): string {
  const parsed = parseMonthInput(value);
  return parsed ? MONTH_FORMATTER.format(parsed) : value;
}

function formatScheduleDate(value: string): string {
  const parsed = parseDateInput(String(value).slice(0, 10));
  return parsed ? SHORT_DATE_FORMATTER.format(parsed) : "-";
}

function isSameDateValue(left: string, right: string): boolean {
  return String(left).slice(0, 10) === String(right).slice(0, 10);
}

function createDefaultForm(): CalendarFormState {
  const today = getTodayDateInputValue();
  return {
    title: "",
    category: "general",
    startDate: today,
    endDate: today,
    isAllDay: true,
    description: "",
  };
}

function buildCalendarDays(month: string): CalendarDay[] {
  const currentMonth = parseMonthInput(month) ?? new Date();
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  gridStart.setHours(0, 0, 0, 0);

  const todayKey = getTodayDateInputValue();

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    date.setHours(0, 0, 0, 0);

    return {
      key: toDateKey(date),
      date,
      dayOfMonth: date.getDate(),
      isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
      isToday: toDateKey(date) === todayKey,
    };
  });
}

function normalizeEventDate(value: string): string {
  return String(value ?? "").slice(0, 10);
}

function MonthlyCalendar({
  days,
  eventsByDate,
  selectedDate,
  onPickDate,
  onOpenEvent,
}: {
  days: CalendarDay[];
  eventsByDate: Map<string, CalendarEventRow[]>;
  selectedDate: string;
  onPickDate: (date: string) => void;
  onOpenEvent?: (event: CalendarEventRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] rounded-[28px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,252,0.96))] p-3 shadow-[var(--shadow-soft)]">
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="rounded-2xl border border-border/80 bg-background-soft px-3 py-2 text-center text-xs font-semibold tracking-[0.18em] text-foreground-muted"
            >
              {label}
            </div>
          ))}

          {days.map((day) => {
            const events = eventsByDate.get(day.key) ?? [];
            const overflowCount = Math.max(0, events.length - MAX_DAY_CHIPS);
            const isSelected = day.key === selectedDate;

            return (
              <div
                key={day.key}
                role="button"
                tabIndex={0}
                onClick={() => onPickDate(day.key)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onPickDate(day.key);
                  }
                }}
                className={[
                  "group min-h-[146px] cursor-pointer rounded-[24px] border px-3 py-3 text-left transition",
                  day.isCurrentMonth
                    ? "border-border bg-background-card hover:border-border-strong hover:bg-white"
                    : "border-border/70 bg-background-soft/80 text-foreground-muted hover:border-border hover:bg-background-soft",
                  day.isToday ? "ring-2 ring-primary/15" : "",
                  isSelected ? "border-primary/60 shadow-[0_18px_40px_rgba(47,118,210,0.12)]" : "",
                ].join(" ")}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span
                    className={[
                      "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold",
                      day.isToday
                        ? "bg-primary text-white"
                        : day.isCurrentMonth
                          ? "bg-background-soft text-foreground"
                          : "bg-background-card text-foreground-muted",
                    ].join(" ")}
                  >
                    {day.dayOfMonth}
                  </span>
                  {events.length > 0 ? (
                    <span className="text-[11px] font-medium text-foreground-muted">{events.length}건</span>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  {events.slice(0, MAX_DAY_CHIPS).map((event) => {
                    const category = normalizeProgressCalendarCategory(event.category);
                    const meta = PROGRESS_CALENDAR_CATEGORY_META[category];
                    const isSingleDay = isSameDateValue(event.startDate, event.endDate);

                    const cardClassName = "w-full rounded-2xl border px-2 py-1.5 text-left text-[11px] leading-4";
                    const cardStyle = {
                      borderColor: event.color ?? meta.color,
                      backgroundColor: `${event.color ?? meta.color}14`,
                    };

                    if (!onOpenEvent) {
                      return (
                        <div key={`${day.key}-${event._id}`} className={cardClassName} style={cardStyle}>
                          <div className="truncate font-semibold text-foreground">{event.title}</div>
                          <div className="truncate text-[10px] text-foreground-muted">
                            {meta.label} · {isSingleDay ? "단일" : "기간"}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={`${day.key}-${event._id}`}
                        type="button"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onOpenEvent(event);
                        }}
                        className={`${cardClassName} transition hover:brightness-[0.98] focus:outline-none focus:ring-2 focus:ring-primary/20`}
                        style={cardStyle}
                      >
                        <div className="truncate font-semibold text-foreground">{event.title}</div>
                        <div className="truncate text-[10px] text-foreground-muted">
                          {meta.label} · {isSingleDay ? "단일" : "기간"}
                        </div>
                      </button>
                    );
                  })}
                  {overflowCount > 0 ? (
                    <div className="rounded-2xl border border-dashed border-border px-2 py-1 text-[11px] text-foreground-muted">
                      +{overflowCount}개 더보기
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M4.167 13.333V15.833H6.667L14.042 8.458A1.178 1.178 0 0 0 14.042 6.792L13.208 5.958A1.178 1.178 0 0 0 11.542 5.958L4.167 13.333Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10.833 6.667L13.333 9.167" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M5.833 6.667V14.167C5.833 14.627 6.206 15 6.667 15H13.333C13.794 15 14.167 14.627 14.167 14.167V6.667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M4.167 5H15.833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M8.333 5V4.167C8.333 3.707 8.706 3.333 9.167 3.333H10.833C11.294 3.333 11.667 3.707 11.667 4.167V5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M8.333 8.333V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.667 8.333V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CalendarSideDrawer({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[color:var(--overlay)]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="ml-auto flex h-full w-full max-w-[560px] flex-col border-l border-border-strong bg-background-card shadow-[-24px_0_60px_rgba(15,23,42,0.16)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-primary">
                New Schedule
              </div>
              <div>
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
                <p className="mt-1 text-[13px] leading-5 text-foreground-muted">{description}</p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background-card px-4 text-[13px] font-medium text-foreground hover:bg-background-soft"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function ProgressCalendarPage() {
  const { user } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [tableItems, setTableItems] = useState<CalendarEventRow[]>([]);
  const [calendarItems, setCalendarItems] = useState<CalendarEventRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [month, setMonth] = useState(() => getMonthValue(new Date()));
  const [categoryFilter, setCategoryFilter] = useState<CalendarCategoryFilter>("all");

  const [selectedDate, setSelectedDate] = useState(() => getTodayDateInputValue());
  const [form, setForm] = useState<CalendarFormState>(createDefaultForm);
  const [isRangeEvent, setIsRangeEvent] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<CalendarDrawerMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const calendarDays = useMemo(() => buildCalendarDays(month), [month]);

  const monthlySummary = useMemo(() => {
    return calendarItems.reduce(
      (accumulator, item) => {
        const category = normalizeProgressCalendarCategory(item.category);
        accumulator.total += 1;
        accumulator.counts[category] += 1;
        return accumulator;
      },
      {
        total: 0,
        counts: {
          general: 0,
          milestone: 0,
          inspection: 0,
        } satisfies Record<ProgressCalendarCategory, number>,
      },
    );
  }, [calendarItems]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();
    const visibleStart = calendarDays[0]?.date ?? parseMonthInput(month) ?? new Date();
    const visibleEnd = calendarDays[calendarDays.length - 1]?.date ?? visibleStart;

    for (const item of calendarItems) {
      const start = parseDateInput(normalizeEventDate(item.startDate));
      const end = parseDateInput(normalizeEventDate(item.endDate));

      if (!start || !end) {
        continue;
      }

      const rangeStart = start.getTime() < visibleStart.getTime() ? visibleStart : start;
      const rangeEnd = end.getTime() > visibleEnd.getTime() ? visibleEnd : end;
      const cursor = new Date(rangeStart);

      while (cursor.getTime() <= rangeEnd.getTime()) {
        const key = toDateKey(cursor);
        const current = map.get(key) ?? [];
        current.push(item);
        map.set(key, current);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const [key, rows] of map.entries()) {
      rows.sort((left, right) => {
        const leftStart = normalizeEventDate(left.startDate);
        const rightStart = normalizeEventDate(right.startDate);
        return leftStart.localeCompare(rightStart) || left.title.localeCompare(right.title, "ko");
      });
      map.set(key, rows);
    }

    return map;
  }, [calendarDays, calendarItems, month]);

  const loadData = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const listParams = new URLSearchParams({
          page: String(nextPage),
          limit: "20",
          q: keyword,
          category: categoryFilter,
          month,
        });
        const calendarParams = new URLSearchParams({
          page: "1",
          limit: String(MAX_CALENDAR_ITEMS),
          q: keyword,
          category: categoryFilter,
          month,
        });

        const [listResponse, calendarResponse] = await Promise.all([
          fetch(`/api/progress/calendar?${listParams.toString()}`, { cache: "no-store" }),
          fetch(`/api/progress/calendar?${calendarParams.toString()}`, { cache: "no-store" }),
        ]);

        const [listResult, calendarResult] = (await Promise.all([
          listResponse.json(),
          calendarResponse.json(),
        ])) as [CalendarResponse, CalendarResponse];

        if (!listResult.ok) {
          throw new Error(listResult.error ?? "일정 목록 조회 실패");
        }
        if (!calendarResult.ok) {
          throw new Error(calendarResult.error ?? "월간 일정 조회 실패");
        }

        setTableItems(listResult.data);
        setCalendarItems(calendarResult.data);
        setPage(listResult.meta?.page ?? 1);
        setTotalPages(listResult.meta?.totalPages ?? 1);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "일정 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [categoryFilter, keyword, month],
  );

  useEffect(() => {
    void loadData(1);
  }, [loadData]);

  function updateForm(patch: Partial<CalendarFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function openCreateDrawer(nextDate: string = selectedDate) {
    const base = createDefaultForm();
    setSelectedDate(nextDate);
    setForm({
      ...base,
      startDate: nextDate,
      endDate: nextDate,
    });
    setDrawerMode("create");
    setEditingId(null);
    setIsRangeEvent(false);
    setFormError(null);
    setIsCreateDrawerOpen(true);
  }

  function openEditDrawer(item: CalendarEventRow) {
    const startDate = normalizeEventDate(item.startDate);
    const endDate = normalizeEventDate(item.endDate);

    setSelectedDate(startDate);
    setForm({
      title: item.title ?? "",
      category: normalizeProgressCalendarCategory(item.category),
      startDate,
      endDate,
      isAllDay: Boolean(item.isAllDay),
      description: item.description ?? "",
    });
    setDrawerMode("edit");
    setEditingId(item._id);
    setIsRangeEvent(startDate !== endDate);
    setFormError(null);
    setIsCreateDrawerOpen(true);
  }

  function openViewDrawer(item: CalendarEventRow) {
    const startDate = normalizeEventDate(item.startDate);
    const endDate = normalizeEventDate(item.endDate);

    setSelectedDate(startDate);
    setForm({
      title: item.title ?? "",
      category: normalizeProgressCalendarCategory(item.category),
      startDate,
      endDate,
      isAllDay: Boolean(item.isAllDay),
      description: item.description ?? "",
    });
    setDrawerMode("view");
    setEditingId(item._id);
    setIsRangeEvent(startDate !== endDate);
    setFormError(null);
    setIsCreateDrawerOpen(true);
  }

  function closeCreateDrawer() {
    if (isSubmitting) {
      return;
    }

    setIsCreateDrawerOpen(false);
    setDrawerMode("create");
    setEditingId(null);
    setFormError(null);
  }

  function handlePickCalendarDate(date: string) {
    setSelectedDate(date);
    if (canWrite) {
      openCreateDrawer(date);
    }
  }

  function handleRequestDelete(item: CalendarEventRow) {
    setDeleteTarget({
      _id: item._id,
      title: item.title ?? "-",
    });
    setFormError(null);
  }

  function handleEnterEditMode() {
    if (!editingId || !canWrite) {
      return;
    }

    setIsCreateDrawerOpen(true);
    setDrawerMode("edit");
    setFormError(null);
  }

  function closeDeleteModal() {
    if (isDeleting) {
      return;
    }
    setDeleteTarget(null);
  }

  function handleCategoryChange(nextCategory: ProgressCalendarCategory) {
    const shouldUseRange = nextCategory === "milestone";
    setIsRangeEvent(shouldUseRange);
    setForm((current) => ({
      ...current,
      category: nextCategory,
      endDate: shouldUseRange ? (current.endDate >= current.startDate ? current.endDate : current.startDate) : current.startDate,
    }));
  }

  function handleRangeModeChange(nextValue: boolean) {
    setIsRangeEvent(nextValue);
    setForm((current) => ({
      ...current,
      endDate: nextValue ? (current.endDate >= current.startDate ? current.endDate : current.startDate) : current.startDate,
    }));
  }

  function handleStartDateChange(nextDate: string) {
    setSelectedDate(nextDate);
    setForm((current) => ({
      ...current,
      startDate: nextDate,
      endDate: !isRangeEvent || current.endDate < nextDate ? nextDate : current.endDate,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setMessage(null);

    try {
      const startDate = form.startDate;
      const endDate = isRangeEvent ? form.endDate : form.startDate;
      const isEditMode = drawerMode === "edit" && editingId;
      const response = await fetch(isEditMode ? `/api/progress/calendar/${editingId}` : "/api/progress/calendar", {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          startDate,
          endDate,
          isAllDay: form.isAllDay,
          description: form.description,
        }),
      });

      const result = (await response.json()) as MutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "일정 등록 실패");
      }

      const nextMonth = startDate.slice(0, 7);
      setSelectedDate(startDate);
      setForm(createDefaultForm());
      setDrawerMode("create");
      setEditingId(null);
      setIsRangeEvent(false);
      setIsCreateDrawerOpen(false);
      setMessage(isEditMode ? "일정을 수정했습니다." : "일정을 등록했습니다.");

      if (nextMonth !== month) {
        setMonth(nextMonth);
      } else {
        void loadData(1);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "일정 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setFormError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/progress/calendar/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as MutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "일정 삭제 실패");
      }

      const isDeletingEditingItem = editingId === deleteTarget._id;
      setDeleteTarget(null);
      if (isDeletingEditingItem) {
        setIsCreateDrawerOpen(false);
        setDrawerMode("create");
        setEditingId(null);
      }
      setMessage("일정을 삭제했습니다.");
      void loadData(page);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "일정 삭제 실패");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: Array<DataTableColumn<CalendarEventRow>> = [
    {
      key: "title",
      header: "제목",
      render: (value) => <span className="font-medium text-foreground">{String(value ?? "-")}</span>,
    },
    {
      key: "category",
      header: "분류",
      className: "whitespace-nowrap",
      render: (value, row) => {
        const category = normalizeProgressCalendarCategory(value);
        const meta = PROGRESS_CALENDAR_CATEGORY_META[category];
        return (
          <span
            className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              color: row.color ?? meta.color,
              backgroundColor: `${row.color ?? meta.color}16`,
            }}
          >
            {meta.label}
          </span>
        );
      },
    },
    {
      key: "startDate",
      header: "일정",
      className: "whitespace-nowrap",
      render: (_value, row) => {
        const sameDate = isSameDateValue(row.startDate, row.endDate);
        return sameDate
          ? formatScheduleDate(row.startDate)
          : `${formatScheduleDate(row.startDate)} ~ ${formatScheduleDate(row.endDate)}`;
      },
    },
    {
      key: "isAllDay",
      header: "형태",
      className: "whitespace-nowrap",
      render: (value, row) => {
        const sameDate = isSameDateValue(row.startDate, row.endDate);
        return `${sameDate ? "단일" : "기간"} · ${Boolean(value) ? "종일" : "시간지정"}`;
      },
    },
    {
      key: "description",
      header: "설명",
      render: (value) => (
        <span className="line-clamp-2 text-sm text-foreground-muted">{String(value ?? "").trim() || "-"}</span>
      ),
    },
  ];

  if (canWrite) {
    columns.push({
      key: "actions",
      header: "관리",
      className: "whitespace-nowrap",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openViewDrawer(row)}
            aria-label="공정 일정 상세/수정"
            title="상세/수정"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-foreground transition hover:bg-background-soft"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => handleRequestDelete(row)}
            aria-label="공정 일정 삭제"
            title="삭제"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-danger/40 text-danger transition hover:bg-danger/10"
          >
            <DeleteIcon />
          </button>
        </div>
      ),
    });
  }

  const sectionTitleClassName = "text-[17px] font-semibold tracking-[-0.02em] text-foreground";
  const sectionDescriptionClassName = "mt-1 text-[13px] leading-5 text-foreground-muted";
  const fieldLabelClassName = "mb-1.5 block text-[11px] font-semibold tracking-[0.12em] text-foreground-muted";
  const controlClassName =
    "h-10 w-full rounded-xl border border-border bg-background-card px-3 text-[13px] text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15";
  const isFormReadOnly = drawerMode === "view";

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-border bg-[radial-gradient(circle_at_top_left,rgba(47,118,210,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,252,0.96))] p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-primary">
              Progress Calendar
            </div>
            <div className="max-w-[780px]">
              <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-foreground">공정 일정 캘린더</h1>
              <p className="mt-2 text-[13px] leading-6 text-foreground-muted">
                월간 캘린더로 전체 흐름을 보고, 일반/점검 일정은 단일 날짜 중심으로 바로 등록합니다.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="rounded-2xl border border-border bg-background-card px-4 py-3">
              <div className="text-[11px] font-semibold tracking-[0.12em] text-foreground-muted">이번 달 일정</div>
              <div className="mt-1 text-[26px] font-semibold leading-none text-foreground">{monthlySummary.total}</div>
            </div>
            {PROGRESS_CALENDAR_CATEGORY_ORDER.map((category) => (
              <div key={category} className="rounded-2xl border border-border bg-background-card px-4 py-3">
                <div className="text-[11px] font-semibold tracking-[0.12em] text-foreground-muted">
                  {PROGRESS_CALENDAR_CATEGORY_META[category].label}
                </div>
                <div
                  className="mt-1 text-[26px] font-semibold leading-none"
                  style={{ color: PROGRESS_CALENDAR_CATEGORY_META[category].color }}
                >
                  {monthlySummary.counts[category]}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="rounded-[28px] border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className={sectionTitleClassName}>일정 필터</h2>
            <p className={sectionDescriptionClassName}>검색, 분류, 기준 월을 먼저 정하고 캘린더와 목록을 함께 확인합니다.</p>
          </div>
          <div className="inline-flex rounded-full border border-border bg-background-soft px-3 py-1.5 text-[12px] font-medium text-foreground-muted">
            {isLoading ? "일정을 불러오는 중입니다." : `${formatMonthLabel(month)} 기준`}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.45fr)_220px_180px] lg:items-end">
          <label>
            <span className={fieldLabelClassName}>검색</span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="제목 또는 설명 검색"
              className={controlClassName}
            />
          </label>

          <label>
            <span className={fieldLabelClassName}>분류</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as CalendarCategoryFilter)}
              className={controlClassName}
            >
              <option value="all">전체</option>
              {PROGRESS_CALENDAR_CATEGORY_ORDER.map((category) => (
                <option key={category} value={category}>
                  {PROGRESS_CALENDAR_CATEGORY_META[category].label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={fieldLabelClassName}>기준 월</span>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className={controlClassName}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-[28px] border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <h2 className={sectionTitleClassName}>월간 캘린더</h2>
            <p className={sectionDescriptionClassName}>
              {canWrite
                ? "빈 날짜 셀은 등록, 일정 chip은 수정으로 연결됩니다."
                : "월간 일정 흐름과 날짜별 등록 현황을 캘린더로 확인합니다."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth((current) => shiftMonth(current, -1))}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background-card px-4 text-[13px] font-semibold text-foreground transition hover:bg-background-soft"
            >
              이전 달
            </button>
            <div className="min-w-[156px] rounded-full border border-border bg-background-soft px-4 py-2 text-center text-[15px] font-semibold text-foreground">
              {formatMonthLabel(month)}
            </div>
            <button
              type="button"
              onClick={() => setMonth((current) => shiftMonth(current, 1))}
              className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background-card px-4 text-[13px] font-semibold text-foreground transition hover:bg-background-soft"
            >
              다음 달
            </button>
            {canWrite ? (
              <button
                type="button"
                onClick={() => openCreateDrawer()}
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-[13px] font-semibold text-white transition hover:brightness-105"
              >
                일정 등록
              </button>
            ) : null}
          </div>
        </div>

        {loadError ? (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">{loadError}</div>
        ) : null}
        {message ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-[13px] text-primary">{message}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {PROGRESS_CALENDAR_CATEGORY_ORDER.map((category) => (
            <div
              key={category}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[12px] text-foreground-muted"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: PROGRESS_CALENDAR_CATEGORY_META[category].color }}
              />
              {PROGRESS_CALENDAR_CATEGORY_META[category].label}
            </div>
          ))}
        </div>

        <MonthlyCalendar
          days={calendarDays}
          eventsByDate={eventsByDate}
          selectedDate={selectedDate}
          onPickDate={handlePickCalendarDate}
          onOpenEvent={openViewDrawer}
        />
      </section>

      <section className="space-y-4 rounded-[28px] border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className={sectionTitleClassName}>일정 목록</h2>
            <p className={sectionDescriptionClassName}>텍스트 기반으로 빠르게 확인할 수 있는 보조 목록입니다.</p>
          </div>
          <div className="text-[12px] text-foreground-muted">
            {isLoading ? "일정을 불러오는 중입니다." : `${page} / ${totalPages} 페이지`}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={tableItems}
          rowKey={(row) => row._id}
          emptyMessage="등록된 일정이 없습니다."
        />

        <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadData(nextPage)} />
      </section>

      <CalendarSideDrawer
        open={isCreateDrawerOpen}
        title={drawerMode === "create" ? "일정 등록" : drawerMode === "edit" ? "일정 수정" : "일정 상세"}
        description={
          drawerMode === "create"
            ? "선택한 날짜를 기준으로 일반, 점검, 마일스톤 일정을 등록합니다."
            : drawerMode === "edit"
              ? "수정 가능한 상태입니다. 변경 후 저장하면 즉시 반영됩니다."
              : "먼저 내용을 확인하고, 수정 버튼을 눌렀을 때만 편집할 수 있습니다."
        }
        onClose={closeCreateDrawer}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-dashed border-border bg-background-soft/60 px-4 py-3 text-[12px] leading-5 text-foreground-muted">
            <div className="font-semibold text-foreground">선택 날짜</div>
            <div className="mt-1">{formatScheduleDate(selectedDate)}</div>
            <div className="mt-2">
              {form.category === "milestone"
                ? "마일스톤은 기간 일정 기본값으로 열립니다. 필요하면 단일 날짜로 전환할 수 있습니다."
                : "일반/점검은 단일 날짜 기본값으로 열립니다. 여러 날 일정이면 기간 일정으로 바꿔 등록하세요."}
            </div>
          </div>

          {formError ? (
            <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-[13px] text-danger">{formError}</div>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4">
              <FormInput
                label="제목"
                value={form.title}
                onChange={(event) => updateForm({ title: event.target.value })}
                placeholder="예: 외장재 품질 점검"
                className="h-10 rounded-xl text-[13px]"
                wrapperClassName="space-y-1.5"
                disabled={isFormReadOnly}
                required
              />

              <label>
                <span className={fieldLabelClassName}>분류</span>
                <select
                  value={form.category}
                  onChange={(event) => handleCategoryChange(event.target.value as ProgressCalendarCategory)}
                  disabled={isFormReadOnly}
                  className={`${controlClassName} disabled:cursor-not-allowed disabled:bg-background-soft disabled:text-foreground-muted`}
                >
                  {PROGRESS_CALENDAR_CATEGORY_ORDER.map((category) => (
                    <option key={category} value={category}>
                      {PROGRESS_CALENDAR_CATEGORY_META[category].label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput
                  label="시작일"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => handleStartDateChange(event.target.value)}
                  className="h-10 rounded-xl text-[13px]"
                  wrapperClassName="space-y-1.5"
                  disabled={isFormReadOnly}
                  required
                />
                <FormInput
                  label={isRangeEvent ? "종료일" : "일정일"}
                  type="date"
                  value={isRangeEvent ? form.endDate : form.startDate}
                  onChange={(event) =>
                    isRangeEvent ? updateForm({ endDate: event.target.value }) : handleStartDateChange(event.target.value)
                  }
                  min={form.startDate}
                  className="h-10 rounded-xl text-[13px]"
                  wrapperClassName="space-y-1.5"
                  disabled={isFormReadOnly}
                  required
                />
              </div>

              <div>
                <span className={fieldLabelClassName}>일정 방식</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRangeModeChange(false)}
                    disabled={isFormReadOnly}
                    className={[
                      "inline-flex h-10 items-center justify-center rounded-2xl border text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
                      !isRangeEvent
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background-card text-foreground hover:bg-background-soft",
                    ].join(" ")}
                  >
                    단일 날짜
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRangeModeChange(true)}
                    disabled={isFormReadOnly}
                    className={[
                      "inline-flex h-10 items-center justify-center rounded-2xl border text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
                      isRangeEvent
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background-card text-foreground hover:bg-background-soft",
                    ].join(" ")}
                  >
                    기간 일정
                  </button>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-2xl border border-border bg-background-soft px-3 py-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                checked={form.isAllDay}
                onChange={(event) => updateForm({ isAllDay: event.target.checked })}
                disabled={isFormReadOnly}
              />
              종일 일정으로 등록
            </label>

            <label className="block">
              <span className={fieldLabelClassName}>설명</span>
              <textarea
                value={form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
                rows={5}
                disabled={isFormReadOnly}
                className="w-full rounded-2xl border border-border bg-background-card px-3 py-2.5 text-[13px] text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-background-soft disabled:text-foreground-muted"
                placeholder="점검 내용, 참석 대상, 준비 사항"
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {canWrite && (drawerMode === "edit" || drawerMode === "view") && editingId ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleRequestDelete({
                        _id: editingId,
                        title: form.title,
                        category: form.category,
                        startDate: form.startDate,
                        endDate: form.endDate,
                        isAllDay: form.isAllDay,
                        description: form.description,
                      })
                    }
                    className="inline-flex h-11 items-center justify-center rounded-full border border-danger/30 px-5 text-[13px] font-semibold text-danger transition hover:bg-danger/10"
                  >
                    삭제
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeCreateDrawer}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-background-card px-5 text-[13px] font-semibold text-foreground transition hover:bg-background-soft"
                >
                  {drawerMode === "view" ? "닫기" : "취소"}
                </button>
              </div>
              {drawerMode === "view" ? (
                canWrite ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleEnterEditMode();
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-[13px] font-semibold text-white transition hover:brightness-105"
                  >
                    수정
                  </button>
                ) : null
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-[13px] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (drawerMode === "edit" ? "수정 중..." : "등록 중...") : drawerMode === "edit" ? "저장" : "등록"}
                </button>
              )}
            </div>
          </form>
        </div>
      </CalendarSideDrawer>

      <Modal open={Boolean(deleteTarget)} title="일정 삭제" onClose={closeDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{deleteTarget?.title ?? "-"}</span> 일정을 삭제하시겠습니까?
          </p>
          <p className="text-xs text-foreground-muted">삭제 후에는 복구할 수 없습니다.</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDeleteModal}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-background-soft"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteConfirm()}
              disabled={isDeleting}
              className="rounded-md bg-danger px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
