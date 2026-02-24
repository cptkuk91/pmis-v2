"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, DataTable, Pagination } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type SupportTicketRow = {
  _id: string;
  ticketNo: string;
  category: "bug" | "feature" | "inquiry" | "complaint";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  title: string;
  content: string;
  reporterName: string;
  reporterEmail: string;
  assigneeName?: string | null;
  resolution?: string | null;
  createdAt: string;
};

type TicketsResponse = {
  ok: boolean;
  data: SupportTicketRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

const categoryLabel: Record<SupportTicketRow["category"], string> = {
  bug: "버그",
  feature: "개선요청",
  inquiry: "문의",
  complaint: "불편신고",
};

function PriorityBadge({ priority }: { priority: SupportTicketRow["priority"] }) {
  if (priority === "urgent") return <Badge tone="danger">긴급</Badge>;
  if (priority === "high") return <Badge tone="warning">높음</Badge>;
  if (priority === "medium") return <Badge tone="info">보통</Badge>;
  return <Badge tone="default">낮음</Badge>;
}

function TicketStatusBadge({ status }: { status: SupportTicketRow["status"] }) {
  if (status === "open") return <Badge tone="info">Open</Badge>;
  if (status === "in_progress") return <Badge tone="warning">In Progress</Badge>;
  if (status === "resolved") return <Badge tone="success">Resolved</Badge>;
  return <Badge tone="default">Closed</Badge>;
}

export default function SupportTicketsPage() {
  const { user } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<SupportTicketRow[]>([]);
  const [keyword, setKeyword] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "inquiry",
    priority: "medium",
    title: "",
    content: "",
    reporterEmail: "",
  });

  const loadTickets = useCallback(
    async (nextPage: number, nextStatus = statusFilter, nextKeyword = searchKeyword) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "12",
          status: nextStatus,
          q: nextKeyword,
        });
        const response = await fetch(`/api/system/support/tickets?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as TicketsResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "티켓 조회 실패");
        }
        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "티켓 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [searchKeyword, statusFilter],
  );

  useEffect(() => {
    void loadTickets(1);
  }, [loadTickets]);

  async function handleCreateTicket() {
    setIsSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/system/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "티켓 등록 실패");
      }
      setForm({
        category: "inquiry",
        priority: "medium",
        title: "",
        content: "",
        reporterEmail: "",
      });
      setShowForm(false);
      setMessage("문의 티켓이 등록되었습니다.");
      await loadTickets(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "티켓 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateTicketStatus(
    ticket: SupportTicketRow,
    nextStatus: SupportTicketRow["status"],
  ) {
    if (!canManage) {
      return;
    }

    let resolution = ticket.resolution ?? "";
    if (nextStatus === "resolved" && !resolution) {
      resolution = prompt("해결 내용을 입력하세요.", "조치 완료") ?? "";
    }

    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/system/support/tickets/${ticket._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          resolution,
          assigneeName: user.userName ?? "담당자",
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "상태 변경 실패");
      }
      setMessage(`티켓 상태가 ${nextStatus}로 변경되었습니다.`);
      await loadTickets(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 변경 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">문의/문제신고</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Support 티켓을 등록하고 처리 상태를 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background"
        >
          {showForm ? "등록 취소" : "신규 티켓 등록"}
        </button>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="티켓번호/제목/작성자 검색"
          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground sm:max-w-md"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
        >
          <option value="all">전체 상태</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setSearchKeyword(keyword.trim());
            void loadTickets(1, statusFilter, keyword.trim());
          }}
          className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background"
        >
          조회
        </button>
      </div>

      {showForm ? (
        <div className="space-y-3 rounded-md border border-border bg-background-soft p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">분류</span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, category: event.target.value }))
                }
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="inquiry">문의</option>
                <option value="bug">버그</option>
                <option value="feature">개선요청</option>
                <option value="complaint">불편신고</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">우선순위</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, priority: event.target.value }))
                }
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
                <option value="urgent">긴급</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">작성자</span>
              <input
                value={user.userName ?? ""}
                disabled
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground-muted"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">이메일</span>
              <input
                value={form.reporterEmail}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, reporterEmail: event.target.value }))
                }
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              />
            </label>
          </div>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">제목</span>
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">내용</span>
            <textarea
              rows={4}
              value={form.content}
              onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleCreateTicket()}
              className="rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground hover:bg-background disabled:opacity-60"
            >
              등록
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<SupportTicketRow>
        columns={[
          { key: "ticketNo", header: "티켓번호", className: "w-36" },
          {
            key: "category",
            header: "분류",
            className: "w-24",
            render: (value) => categoryLabel[value as SupportTicketRow["category"]] ?? String(value),
          },
          { key: "title", header: "제목" },
          {
            key: "priority",
            header: "우선순위",
            className: "w-24",
            render: (value) => <PriorityBadge priority={value as SupportTicketRow["priority"]} />,
          },
          {
            key: "status",
            header: "상태",
            className: "w-28",
            render: (value) => <TicketStatusBadge status={value as SupportTicketRow["status"]} />,
          },
          { key: "reporterName", header: "작성자", className: "w-24" },
          {
            key: "createdAt",
            header: "등록일",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          {
            key: "_id",
            header: "처리",
            className: "w-56",
            render: (_value, row) =>
              canManage ? (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => void updateTicketStatus(row, "in_progress")}
                    className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                  >
                    진행중
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateTicketStatus(row, "resolved")}
                    className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                  >
                    해결
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateTicketStatus(row, "closed")}
                    className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                  >
                    종결
                  </button>
                </div>
              ) : (
                "-"
              ),
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 티켓이 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadTickets(nextPage)} />
    </section>
  );
}
