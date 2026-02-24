"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, DataTable, Modal, Pagination } from "@/components/ui";
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

type ToastState = {
  tone: "success" | "error";
  message: string;
} | null;

type PendingResolvedChange = {
  ticketId: string;
  nextStatus: SupportTicketRow["status"];
} | null;

const categoryLabel: Record<SupportTicketRow["category"], string> = {
  bug: "버그",
  feature: "개선요청",
  inquiry: "문의",
  complaint: "불편신고",
};

const statusLabel: Record<SupportTicketRow["status"], string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
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
  const [isUpdatingTicketId, setIsUpdatingTicketId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [pendingResolvedChange, setPendingResolvedChange] = useState<PendingResolvedChange>(null);
  const [resolvedMemo, setResolvedMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "inquiry",
    priority: "medium",
    title: "",
    content: "",
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

  const showToast = useCallback((nextMessage: string, tone: "success" | "error" = "success") => {
    setToast({ tone, message: nextMessage });
  }, []);

  useEffect(() => {
    void loadTickets(1);
  }, [loadTickets]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleCreateTicket() {
    const reporterEmail = user.email?.trim() ?? "";
    if (!reporterEmail) {
      const nextError = "로그인 사용자 이메일을 확인할 수 없습니다. 다시 로그인해 주세요.";
      setError(nextError);
      showToast(nextError, "error");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/system/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          reporterEmail,
        }),
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
      });
      setShowForm(false);
      showToast("문의 티켓이 등록되었습니다.", "success");
      await loadTickets(1);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "티켓 등록 실패";
      setError(nextError);
      showToast(nextError, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateTicketStatus(
    ticket: SupportTicketRow,
    nextStatus: SupportTicketRow["status"],
    resolutionOverride?: string,
  ) {
    if (!canManage) {
      return;
    }
    if (ticket.status === nextStatus) {
      return;
    }

    if (
      nextStatus === "resolved" &&
      !(resolutionOverride?.trim() || ticket.resolution?.trim())
    ) {
      setResolvedMemo("");
      setPendingResolvedChange({ ticketId: ticket._id, nextStatus });
      return;
    }

    setError(null);
    setIsUpdatingTicketId(ticket._id);
    try {
      const response = await fetch(`/api/system/support/tickets/${ticket._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          resolution: resolutionOverride ?? ticket.resolution ?? "",
          assigneeName: user.userName ?? "담당자",
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "상태 변경 실패");
      }
      showToast(`티켓 상태가 ${statusLabel[nextStatus]}로 변경되었습니다.`, "success");
      await loadTickets(page);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "상태 변경 실패";
      setError(nextError);
      showToast(nextError, "error");
    } finally {
      setIsUpdatingTicketId(null);
    }
  }

  async function handleConfirmResolvedModal() {
    if (!pendingResolvedChange) {
      return;
    }

    const targetTicket = items.find((item) => item._id === pendingResolvedChange.ticketId);
    if (!targetTicket) {
      setPendingResolvedChange(null);
      showToast("대상 티켓을 찾을 수 없습니다. 목록을 새로고침하세요.", "error");
      return;
    }

    const resolutionText = resolvedMemo.trim();
    if (!resolutionText) {
      showToast("해결 내용을 입력해 주세요.", "error");
      return;
    }

    await updateTicketStatus(targetTicket, pendingResolvedChange.nextStatus, resolutionText);
    setPendingResolvedChange(null);
    setResolvedMemo("");
  }

  return (
    <>
      {toast ? (
        <div className="pointer-events-none fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
          <div
            className={`min-w-[15rem] rounded-md border px-3 py-2 text-sm shadow-[var(--shadow-soft)] ${
              toast.tone === "success"
                ? "border-success/30 bg-success/10 text-foreground"
                : "border-danger/30 bg-danger/10 text-foreground"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        </div>
      ) : null}

      <section className="space-y-4 rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)] sm:p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">문의/문제신고</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Support 티켓을 등록하고 처리 상태를 관리합니다.
          </p>
        </div>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background"
          >
            신규 티켓 등록
          </button>
        ) : null}
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
                value={user.email ?? ""}
                disabled
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground-muted"
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
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background"
            >
              취소
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleCreateTicket()}
              className="rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground hover:bg-background disabled:opacity-60"
            >
              저장
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<SupportTicketRow>
        columns={[
          { key: "ticketNo", header: "티켓번호", className: "w-28 whitespace-nowrap" },
          {
            key: "category",
            header: "분류",
            className: "w-20 whitespace-nowrap hidden md:table-cell",
            render: (value) => categoryLabel[value as SupportTicketRow["category"]] ?? String(value),
          },
          {
            key: "title",
            header: "제목",
            className: "max-w-[28rem]",
            render: (value) => (
              <span className="block truncate" title={String(value ?? "")}>
                {String(value ?? "")}
              </span>
            ),
          },
          {
            key: "priority",
            header: "우선순위",
            className: "w-20 whitespace-nowrap hidden xl:table-cell",
            render: (value) => <PriorityBadge priority={value as SupportTicketRow["priority"]} />,
          },
          {
            key: "status",
            header: "상태",
            className: "w-24 whitespace-nowrap",
            render: (value) => <TicketStatusBadge status={value as SupportTicketRow["status"]} />,
          },
          { key: "reporterName", header: "작성자", className: "w-24 hidden lg:table-cell" },
          {
            key: "createdAt",
            header: "등록일",
            className: "w-24 whitespace-nowrap hidden xl:table-cell",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          {
            key: "_id",
            header: "처리",
            className: "w-40 whitespace-nowrap",
            render: (_value, row) =>
              canManage ? (
                <select
                  value={row.status}
                  disabled={isUpdatingTicketId === row._id}
                  onChange={(event) => {
                    const nextStatus = event.target.value as SupportTicketRow["status"];
                    void updateTicketStatus(row, nextStatus);
                  }}
                  className="h-8 min-w-[9rem] rounded-md border border-border bg-background-card px-2 text-xs text-foreground disabled:opacity-60"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              ) : (
                <span className="text-xs text-foreground-muted">권한없음</span>
              ),
          },
        ]}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 티켓이 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadTickets(nextPage)} />
      </section>

      <Modal
        open={pendingResolvedChange !== null}
        title="해결 내용 입력"
        onClose={() => {
          setPendingResolvedChange(null);
          setResolvedMemo("");
        }}
      >
        <div className="space-y-3">
          <p className="text-sm text-foreground-muted">
            `Resolved` 상태로 변경하려면 해결 내용을 입력해 주세요.
          </p>
          <textarea
            rows={4}
            value={resolvedMemo}
            onChange={(event) => setResolvedMemo(event.target.value)}
            placeholder="예: 서버 재기동 및 설정 수정 완료"
            className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background"
              onClick={() => {
                setPendingResolvedChange(null);
                setResolvedMemo("");
              }}
            >
              취소
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground hover:bg-background disabled:opacity-60"
              onClick={() => void handleConfirmResolvedModal()}
              disabled={resolvedMemo.trim().length === 0}
            >
              상태 변경
            </button>
          </div>
        </div>
      </Modal>
  </>
  );
}
