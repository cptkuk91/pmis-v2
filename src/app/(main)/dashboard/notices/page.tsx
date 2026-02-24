"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, FormInput, Pagination, StatusBadge } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type NoticeItem = {
  _id: string;
  title: string;
  content: string;
  authorName: string;
  isPinned: boolean;
  postedAt: string;
};

type NoticeResponse = {
  ok: boolean;
  data: NoticeItem[];
  meta?: { page: number; totalPages: number; total: number };
  error?: string;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ko-KR");
}

export default function DashboardNoticesPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = hasMinRole(user.role, "manager");

  const [items, setItems] = useState<NoticeItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [pinnedFilter, setPinnedFilter] = useState<"all" | "true" | "false">("all");
  const [sort, setSort] = useState<"latest" | "oldest" | "title_asc" | "title_desc">("latest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadNotices = useCallback(async (nextPage: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "10",
        q: keyword,
        sort,
      });
      if (pinnedFilter !== "all") {
        params.set("pinned", pinnedFilter);
      }

      const response = await fetch(`/api/dashboard/notices?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as NoticeResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "공지사항 조회 실패");
      }
      setItems(result.data);
      setPage(result.meta?.page ?? 1);
      setTotalPages(result.meta?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공지사항 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, [keyword, pinnedFilter, sort]);

  useEffect(() => {
    void loadNotices(1);
  }, [loadNotices]);

  function resetForm() {
    setEditingNoticeId(null);
    setTitle("");
    setContent("");
    setIsPinned(false);
  }

  function handleEdit(item: NoticeItem) {
    setEditingNoticeId(item._id);
    setTitle(item.title);
    setContent(item.content);
    setIsPinned(item.isPinned);
    setMessage(null);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const endpoint = editingNoticeId
        ? `/api/dashboard/notices/${editingNoticeId}`
        : "/api/dashboard/notices";
      const method = editingNoticeId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, isPinned }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "공지 저장 실패");
      }
      resetForm();
      setMessage(editingNoticeId ? "공지사항이 수정되었습니다." : "공지사항이 등록되었습니다.");
      await loadNotices(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공지 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(noticeId: string) {
    if (!canManage || !confirm("공지사항을 삭제하시겠습니까?")) {
      return;
    }

    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/dashboard/notices/${noticeId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "공지 삭제 실패");
      }
      if (editingNoticeId === noticeId) {
        resetForm();
      }
      setMessage("공지사항이 삭제되었습니다.");
      await loadNotices(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공지 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">공지사항</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Phase 2 1팀: 공지사항 목록/등록 연동
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_180px_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="제목/내용/작성자"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">고정여부</span>
          <select
            value={pinnedFilter}
            onChange={(event) => setPinnedFilter(event.target.value as "all" | "true" | "false")}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="true">고정</option>
            <option value="false">일반</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">정렬</span>
          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as "latest" | "oldest" | "title_asc" | "title_desc")
            }
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="title_asc">제목 오름차순</option>
            <option value="title_desc">제목 내림차순</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void loadNotices(1)}
          className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          조회
        </button>
      </div>

      {canManage ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto_auto_auto]">
          <FormInput
            label="제목"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <FormInput
            label="내용"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
          />
          <label className="mt-6 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(event) => setIsPinned(event.target.checked)}
            />
            상단고정
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
          >
            {editingNoticeId ? "수정" : "등록"}
          </button>
          {editingNoticeId ? (
            <button
              type="button"
              onClick={resetForm}
              className="mt-6 rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              취소
            </button>
          ) : null}
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">등록/수정/삭제는 `manager` 이상 권한이 필요합니다.</p>
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}

      <DataTable<NoticeItem>
        columns={[
          { key: "title", header: "제목" },
          {
            key: "content",
            header: "내용",
            render: (value) => {
              const text = String(value ?? "");
              return text.length > 42 ? `${text.slice(0, 42)}...` : text;
            },
          },
          { key: "authorName", header: "작성자", className: "w-32" },
          {
            key: "isPinned",
            header: "상태",
            className: "w-28",
            render: (value) =>
              value ? <StatusBadge status="warning" /> : <StatusBadge status="info" />,
          },
          {
            key: "postedAt",
            header: "등록일",
            className: "w-32",
            render: (value) => formatDate(String(value)),
          },
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
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 공지사항이 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadNotices(nextPage)} />
    </section>
  );
}
