"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { DataTable, FormInput, Pagination, StatusBadge } from "@/components/ui";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type ChangeItem = {
  _id: string;
  changeNo: string;
  drawingId?: string | null;
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

type DrawingOption = {
  _id: string;
  drawingNo: string;
  drawingName: string;
  location: string;
};

type DrawingLookupResponse = {
  ok: boolean;
  data: DrawingOption[];
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
  const [initialDrawingId, setInitialDrawingId] = useState("");
  const [changeNo, setChangeNo] = useState("");
  const [drawingId, setDrawingId] = useState("");
  const [drawingNo, setDrawingNo] = useState("");
  const [drawingName, setDrawingName] = useState("");
  const [drawingSearch, setDrawingSearch] = useState("");
  const [drawingOptions, setDrawingOptions] = useState<DrawingOption[]>([]);
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<ChangeItem["status"]>("in_review");

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const deferredDrawingSearch = useDeferredValue(drawingSearch);
  const selectedDrawingOption = useMemo(() => {
    if (!drawingId) {
      return null;
    }

    return (
      drawingOptions.find((item) => item._id === drawingId) ?? {
        _id: drawingId,
        drawingNo,
        drawingName,
        location,
      }
    );
  }, [drawingId, drawingName, drawingNo, drawingOptions, location]);

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

  const loadDrawings = useCallback(async (query: string) => {
    if (!canManage) {
      setDrawingOptions([]);
      return;
    }

    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "100",
        status: "all",
        q: query,
      });
      const response = await fetch(`/api/drawings?${params.toString()}`, { cache: "no-store" });
      const result = (await response.json()) as DrawingLookupResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "도면 목록 조회 실패");
      }
      setDrawingOptions(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "도면 목록 조회 실패");
    }
  }, [canManage]);

  useEffect(() => {
    void loadItems(1);
  }, [loadItems]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    void loadDrawings(deferredDrawingSearch.trim());
  }, [canManage, deferredDrawingSearch, loadDrawings]);

  useEffect(() => {
    if (drawingId || !drawingNo || drawingOptions.length === 0) {
      return;
    }

    const matched = drawingOptions.find((item) => item.drawingNo === drawingNo);
    if (!matched) {
      return;
    }

    setDrawingId(matched._id);
    setDrawingName(matched.drawingName);
    if (!location) {
      setLocation(matched.location);
    }
  }, [drawingId, drawingNo, drawingOptions, location]);

  function handleSelectDrawing(nextDrawingId: string) {
    setDrawingId(nextDrawingId);

    const selected = drawingOptions.find((item) => item._id === nextDrawingId);
    if (!selected) {
      setDrawingNo("");
      setDrawingName("");
      return;
    }

    setDrawingNo(selected.drawingNo);
    setDrawingName(selected.drawingName);
    setLocation(selected.location);
  }

  function resetForm() {
    setEditingId(null);
    setInitialDrawingId("");
    setChangeNo("");
    setDrawingId("");
    setDrawingNo("");
    setDrawingName("");
    setDrawingSearch("");
    setLocation("");
    setReason("");
    setStatus("in_review");
  }

  function handleEdit(item: ChangeItem) {
    setEditingId(item._id);
    setInitialDrawingId(item.drawingId ?? "");
    setChangeNo(item.changeNo);
    setDrawingId(item.drawingId ?? "");
    setDrawingNo(item.drawingNo);
    setDrawingName(item.drawingName);
    setDrawingSearch(item.drawingNo);
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
      if (!drawingId) {
        throw new Error("도면대장에서 기준 도면을 선택해 주세요.");
      }

      const endpoint = editingId ? `/api/design/changes/${editingId}` : "/api/design/changes";
      const method = editingId ? "PATCH" : "POST";
      const payload = {
        changeNo,
        ...(editingId
          ? (drawingId && drawingId !== initialDrawingId ? { drawingId } : {})
          : { drawingId }),
        location,
        reason,
        status,
      };
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[160px_minmax(220px,1fr)_minmax(300px,1.2fr)_160px] xl:items-end">
            <FormInput label="변경번호" value={changeNo} onChange={(event) => setChangeNo(event.target.value)} required />
            <FormInput
              label="도면 검색"
              value={drawingSearch}
              onChange={(event) => setDrawingSearch(event.target.value)}
              placeholder="도면번호 또는 도면명 검색"
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">도면 선택</span>
              <select
                value={drawingId}
                onChange={(event) => handleSelectDrawing(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="">도면대장에서 선택해 주세요.</option>
                {selectedDrawingOption && !drawingOptions.some((item) => item._id === selectedDrawingOption._id) ? (
                  <option value={selectedDrawingOption._id}>
                    {selectedDrawingOption.drawingNo} · {selectedDrawingOption.drawingName}
                  </option>
                ) : null}
                {drawingOptions.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.drawingNo} · {item.drawingName}
                  </option>
                ))}
              </select>
            </label>
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
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[180px_minmax(260px,1fr)_200px_minmax(280px,1fr)_auto] xl:items-end">
            <FormInput label="도면번호" value={drawingNo} readOnly disabled />
            <FormInput label="도면명" value={drawingName} readOnly disabled />
            <FormInput label="위치" value={location} onChange={(event) => setLocation(event.target.value)} />
            <FormInput label="변경사유" value={reason} onChange={(event) => setReason(event.target.value)} />
            <div className="flex flex-wrap items-end justify-end gap-2 md:col-span-2 xl:col-span-1">
              <button type="submit" disabled={isSubmitting} className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60">
                {editingId ? "수정" : "등록"}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft">
                  취소
                </button>
              ) : null}
            </div>
          </div>
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
