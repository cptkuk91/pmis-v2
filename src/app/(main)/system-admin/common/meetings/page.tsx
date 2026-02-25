"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination } from "@/components/ui";
import { MeetingMinutesPanel } from "@/components/features/system-admin/meeting-minutes-panel";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type MeetingItem = {
  _id: string;
  category: string;
  agenda: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  location: string;
  host: string;
  notice?: string;
};

type MeetingResponse = {
  ok: boolean;
  data: MeetingItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type MeetingsTab = "meetings" | "minutes";

function parseTab(value: string | null): MeetingsTab {
  return value === "minutes" ? "minutes" : "meetings";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ko-KR");
}

function toDateInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export default function SystemMeetingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTabFromQuery = parseTab(searchParams.get("tab"));
  const [tab, setTab] = useState<MeetingsTab>(currentTabFromQuery);

  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<MeetingItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<"latest" | "oldest" | "agenda_asc" | "agenda_desc">("latest");

  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [category, setCategory] = useState("현장회의");
  const [agenda, setAgenda] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("회의실");
  const [host, setHost] = useState("");
  const [notice, setNotice] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTab(currentTabFromQuery);
  }, [currentTabFromQuery]);

  const handleChangeTab = useCallback(
    (nextTab: MeetingsTab) => {
      setTab(nextTab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", nextTab);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const loadMeetings = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          sort,
        });
        if (categoryFilter !== "all") {
          params.set("category", categoryFilter);
        }
        const response = await fetch(`/api/meetings?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as MeetingResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "회의 조회 실패");
        }
        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "회의 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [categoryFilter, keyword, sort],
  );

  useEffect(() => {
    void loadMeetings(1);
  }, [loadMeetings]);

  function resetForm() {
    setEditingMeetingId(null);
    setCategory("현장회의");
    setAgenda("");
    setMeetingDate(new Date().toISOString().slice(0, 10));
    setStartTime("09:00");
    setEndTime("10:00");
    setLocation("회의실");
    setHost("");
    setNotice("");
  }

  function handleEdit(item: MeetingItem) {
    setEditingMeetingId(item._id);
    setCategory(item.category);
    setAgenda(item.agenda);
    setMeetingDate(toDateInputValue(item.meetingDate));
    setStartTime(item.startTime ?? "09:00");
    setEndTime(item.endTime ?? "10:00");
    setLocation(item.location ?? "");
    setHost(item.host ?? "");
    setNotice(item.notice ?? "");
    setMessage(null);
    setError(null);
  }

  async function handleCreateOrUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const endpoint = editingMeetingId ? `/api/meetings/${editingMeetingId}` : "/api/meetings";
      const method = editingMeetingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          agenda,
          meetingDate,
          startTime,
          endTime,
          location,
          host,
          notice,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "회의 저장 실패");
      }

      setMessage(editingMeetingId ? "회의가 수정되었습니다." : "회의가 등록되었습니다.");
      resetForm();
      await loadMeetings(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회의 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(meetingId: string) {
    if (!canManage || !confirm("회의를 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "회의 삭제 실패");
      }
      if (editingMeetingId === meetingId) {
        resetForm();
      }
      setMessage("회의가 삭제되었습니다.");
      await loadMeetings(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회의 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">회의/회의록</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          시스템 관리 {" > "} 공통 {" > "} 회의/회의록
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 rounded-lg border border-border bg-background-soft p-1">
        <button
          type="button"
          onClick={() => handleChangeTab("meetings")}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            tab === "meetings"
              ? "bg-[#ecebe8] font-medium text-foreground"
              : "text-foreground-muted hover:bg-background-card hover:text-foreground"
          }`}
        >
          회의개최현황
        </button>
        <button
          type="button"
          onClick={() => handleChangeTab("minutes")}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            tab === "minutes"
              ? "bg-[#ecebe8] font-medium text-foreground"
              : "text-foreground-muted hover:bg-background-card hover:text-foreground"
          }`}
        >
          회의록
        </button>
      </nav>

      {tab === "meetings" ? (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_200px_180px_auto]">
            <FormInput
              label="검색어"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="구분/안건/장소/주관"
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">회의구분</span>
              <input
                value={categoryFilter === "all" ? "" : categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value ? event.target.value : "all")}
                placeholder="전체는 비워두기"
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">정렬</span>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as "latest" | "oldest" | "agenda_asc" | "agenda_desc")
                }
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="latest">최신순</option>
                <option value="oldest">오래된순</option>
                <option value="agenda_asc">안건 오름차순</option>
                <option value="agenda_desc">안건 내림차순</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadMeetings(1)}
              className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
            >
              조회
            </button>
          </div>

          {canManage ? (
            <form
              onSubmit={handleCreateOrUpdate}
              className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
            >
              <FormInput
                label="회의구분"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required
              />
              <FormInput
                label="안건"
                value={agenda}
                onChange={(event) => setAgenda(event.target.value)}
                required
              />
              <FormInput
                label="회의일자"
                type="date"
                value={meetingDate}
                onChange={(event) => setMeetingDate(event.target.value)}
                required
              />
              <FormInput
                label="장소"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
              <FormInput
                label="시작시간"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
              <FormInput
                label="종료시간"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
              <FormInput
                label="주관"
                value={host}
                onChange={(event) => setHost(event.target.value)}
              />
              <FormInput
                label="공지사항"
                value={notice}
                onChange={(event) => setNotice(event.target.value)}
              />
              <div className="flex items-center gap-2 xl:col-span-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
                >
                  {editingMeetingId ? "수정" : "회의 등록"}
                </button>
                {editingMeetingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                  >
                    취소
                  </button>
                ) : null}
              </div>
            </form>
          ) : isUserLoading ? null : (
            <p className="text-sm text-foreground-muted">등록/수정/삭제는 `manager` 이상 권한이 필요합니다.</p>
          )}

          {message ? <p className="text-sm text-success">{message}</p> : null}
          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <DataTable<MeetingItem>
            columns={[
              { key: "category", header: "구분", className: "w-36" },
              { key: "agenda", header: "안건" },
              {
                key: "meetingDate",
                header: "일자",
                className: "w-32",
                render: (value) => formatDate(String(value)),
              },
              {
                key: "startTime",
                header: "시간",
                className: "w-36",
                render: (value, row) => `${String(value)} ~ ${row.endTime}`,
              },
              { key: "location", header: "장소", className: "w-32" },
              { key: "host", header: "주관", className: "w-28" },
              {
                key: "_id",
                header: "관리",
                className: "w-36",
                render: (_, row) =>
                  canManage ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(row)}
                        className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row._id)}
                        className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10"
                      >
                        삭제
                      </button>
                    </div>
                  ) : (
                    "-"
                  ),
              },
            ]}
            data={items}
            rowKey={(row) => row._id}
            emptyMessage={isLoading ? "불러오는 중..." : "회의 데이터가 없습니다."}
          />

          <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadMeetings(nextPage)} />
        </>
      ) : (
        <MeetingMinutesPanel />
      )}
    </section>
  );
}
