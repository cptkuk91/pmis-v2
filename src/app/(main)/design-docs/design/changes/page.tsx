"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination, StatusBadge } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type ChangeItem = {
  _id: string;
  changeNo: string;
  drawingNo: string;
  drawingName: string;
  location: string;
  reason: string;
  requestedByName: string;
  status: "draft" | "in_review" | "approved" | "rejected" | "completed";
  requestedAt: string;
};

type ChangeResponse = {
  ok: boolean;
  data: ChangeItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

export default function DesignChangesPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<ChangeItem[]>([]);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [changeNo, setChangeNo] = useState("");
  const [drawingNo, setDrawingNo] = useState("");
  const [drawingName, setDrawingName] = useState("");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<ChangeItem["status"]>("in_review");

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadItems = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          status: statusFilter,
        });
        const response = await fetch(`/api/design/changes?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as ChangeResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "설계변경 조회 실패");
        }
        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "설계변경 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, statusFilter],
  );

  useEffect(() => {
    void loadItems(1);
  }, [loadItems]);

  function resetForm() {
    setEditingId(null);
    setChangeNo("");
    setDrawingNo("");
    setDrawingName("");
    setLocation("");
    setReason("");
    setStatus("in_review");
  }

  function handleEdit(item: ChangeItem) {
    setEditingId(item._id);
    setChangeNo(item.changeNo);
    setDrawingNo(item.drawingNo);
    setDrawingName(item.drawingName);
    setLocation(item.location);
    setReason(item.reason);
    setStatus(item.status);
    setError(null);
    setMessage(null);
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
      const endpoint = editingId ? `/api/design/changes/${editingId}` : "/api/design/changes";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeNo, drawingNo, drawingName, location, reason, status }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "설계변경 저장 실패");
      }
      resetForm();
      setMessage(editingId ? "설계변경이 수정되었습니다." : "설계변경이 등록되었습니다.");
      await loadItems(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "설계변경 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!canManage || !confirm("설계변경을 삭제하시겠습니까?")) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/design/changes/${id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "설계변경 삭제 실패");
      }
      if (editingId === id) {
        resetForm();
      }
      setMessage("설계변경이 삭제되었습니다.");
      await loadItems(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "설계변경 삭제 실패");
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">설계변경현황</h1>
        <p className="mt-1 text-sm text-foreground-muted">설계변경 요청/검토 상태를 관리합니다.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]">
        <FormInput label="검색어" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="변경번호/도면번호/도면명/위치/사유" />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">상태</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
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
        <button type="button" onClick={() => void loadItems(1)} className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card">
          조회
        </button>
      </div>

      {canManage ? (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-[140px_140px_1fr_1fr_1fr_160px_auto_auto]">
          <FormInput label="변경번호" value={changeNo} onChange={(event) => setChangeNo(event.target.value)} required />
          <FormInput label="도면번호" value={drawingNo} onChange={(event) => setDrawingNo(event.target.value)} required />
          <FormInput label="도면명" value={drawingName} onChange={(event) => setDrawingName(event.target.value)} required />
          <FormInput label="위치" value={location} onChange={(event) => setLocation(event.target.value)} />
          <FormInput label="변경사유" value={reason} onChange={(event) => setReason(event.target.value)} />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">상태</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ChangeItem["status"])}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="draft">임시저장</option>
              <option value="in_review">검토중</option>
              <option value="approved">승인</option>
              <option value="rejected">반려</option>
              <option value="completed">완료</option>
            </select>
          </label>
          <button type="submit" disabled={isSubmitting} className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60">
            {editingId ? "수정" : "등록"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} className="mt-6 rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft">
              취소
            </button>
          ) : null}
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">설계변경 등록/수정/삭제는 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<ChangeItem>
        columns={[
          { key: "changeNo", header: "변경번호", className: "w-28" },
          { key: "drawingNo", header: "도면번호", className: "w-24" },
          { key: "drawingName", header: "도면명" },
          { key: "location", header: "위치", className: "w-24" },
          { key: "reason", header: "사유" },
          {
            key: "status",
            header: "상태",
            className: "w-24",
            render: (value) => <StatusBadge status={value as ChangeItem["status"]} />,
          },
          {
            key: "requestedAt",
            header: "요청일",
            className: "w-28",
            render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
          },
          {
            key: "_id",
            header: "관리",
            className: "w-36",
            render: (_, row) =>
              canManage ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleEdit(row)} className="rounded border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft">
                    수정
                  </button>
                  <button type="button" onClick={() => void handleDelete(row._id)} className="rounded border border-danger/40 px-2 py-1 text-xs text-danger hover:bg-danger/10">
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
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 설계변경이 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadItems(nextPage)} />
    </section>
  );
}
