"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination, StatusBadge } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type IssueItem = {
  _id: string;
  title: string;
  content: string;
  authorName: string;
  status: "open" | "closed";
  createdAt: string;
};

type IssueResponse = {
  ok: boolean;
  data: IssueItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

export default function SystemIssuesPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<IssueItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"open" | "closed">("open");
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [sort, setSort] = useState<"latest" | "oldest" | "title_asc" | "title_desc">("latest");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadIssues = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          sort,
          status: statusFilter,
        });
        const response = await fetch(`/api/issues?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as IssueResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "이슈 조회 실패");
        }
        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "이슈 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, sort, statusFilter],
  );

  useEffect(() => {
    void loadIssues(1);
  }, [loadIssues]);

  function resetForm() {
    setEditingIssueId(null);
    setTitle("");
    setContent("");
    setStatus("open");
  }

  function handleEdit(item: IssueItem) {
    setEditingIssueId(item._id);
    setTitle(item.title);
    setContent(item.content);
    setStatus(item.status);
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
      const endpoint = editingIssueId ? `/api/issues/${editingIssueId}` : "/api/issues";
      const method = editingIssueId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, status }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "이슈 저장 실패");
      }
      setMessage(editingIssueId ? "이슈가 수정되었습니다." : "이슈가 등록되었습니다.");
      resetForm();
      await loadIssues(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이슈 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(issueId: string) {
    if (!canManage || !confirm("이슈를 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "이슈 삭제 실패");
      }
      if (editingIssueId === issueId) {
        resetForm();
      }
      setMessage("이슈가 삭제되었습니다.");
      await loadIssues(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이슈 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">ISSUE</h1>
        <p className="mt-1 text-sm text-foreground-muted">이슈 게시판 CRUD</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_180px_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="제목/내용/작성자"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">상태</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "open" | "closed")}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
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
          onClick={() => void loadIssues(1)}
          className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          조회
        </button>
      </div>

      {canManage ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_160px_auto_auto]">
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
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">상태</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "open" | "closed")}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
          >
            {editingIssueId ? "수정" : "등록"}
          </button>
          {editingIssueId ? (
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

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<IssueItem>
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
          { key: "authorName", header: "작성자", className: "w-28" },
          {
            key: "status",
            header: "상태",
            className: "w-24",
            render: (value) => <StatusBadge status={value as IssueItem["status"]} />,
          },
          {
            key: "createdAt",
            header: "등록일",
            className: "w-32",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
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
        emptyMessage={isLoading ? "불러오는 중..." : "이슈가 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadIssues(nextPage)} />
    </section>
  );
}
