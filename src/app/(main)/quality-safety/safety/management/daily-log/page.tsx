"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { DataTable, FormInput, Modal, Pagination, StatusBadge } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type Status = "draft" | "in_review" | "approved" | "rejected" | "completed";

type DailySafetyLogRow = {
  _id: string;
  logDate: string;
  weather: string;
  workersCount: number;
  hazards: string;
  actions: string;
  notes: string;
  managerName: string;
  status: Status;
  management?: string;
};

type DailySafetyLogResponse = {
  ok: boolean;
  data: DailySafetyLogRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type DailySafetyLogFormState = {
  logDate: string;
  weather: string;
  workersCount: number;
  hazards: string;
  actions: string;
  notes: string;
  status: Status;
};

type DeleteTarget = {
  _id: string;
  title: string;
};

function canManageLogStatus(status: Status): boolean {
  return status === "draft" || status === "completed";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPrintHtml(item: DailySafetyLogRow): string {
  const logDate = new Date(item.logDate).toLocaleDateString("ko-KR");
  const hazards = escapeHtml(item.hazards || "-");
  const actions = escapeHtml(item.actions || "-");
  const notes = escapeHtml(item.notes || "-");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>안전 일지</title>
  <style>
    body { font-family: "Noto Sans KR", "Malgun Gothic", sans-serif; margin: 24px; color: #222; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #cfcfcf; padding: 8px; font-size: 13px; vertical-align: top; }
    th { width: 120px; background: #f4f4f4; text-align: left; }
    .box { min-height: 92px; }
    .sign-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
    .sign { border: 1px solid #cfcfcf; padding: 12px; min-height: 80px; }
    .muted { color: #666; font-size: 12px; margin-top: 12px; }
    @media print { body { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>안전 일지</h1>
  <table>
    <tr><th>일자</th><td>${logDate}</td><th>기상</th><td>${escapeHtml(item.weather || "-")}</td></tr>
    <tr><th>근무인원</th><td>${item.workersCount}명</td><th>관리자</th><td>${escapeHtml(item.managerName || "-")}</td></tr>
    <tr><th>상태</th><td colspan="3">${escapeHtml(item.status)}</td></tr>
    <tr><th>위험요인</th><td colspan="3" class="box">${hazards}</td></tr>
    <tr><th>조치사항</th><td colspan="3" class="box">${actions}</td></tr>
    <tr><th>특이사항</th><td colspan="3" class="box">${notes}</td></tr>
  </table>
  <div class="sign-row">
    <div class="sign">안전팀 작성</div>
    <div class="sign">현장소장 확인</div>
  </div>
  <p class="muted">출력시각: ${new Date().toLocaleString("ko-KR")}</p>
</body>
</html>`;
}

function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createDefaultForm(): DailySafetyLogFormState {
  return {
    logDate: getTodayDateInputValue(),
    weather: "",
    workersCount: 0,
    hazards: "",
    actions: "",
    notes: "",
    status: "draft",
  };
}

type DailySafetyLogFormFieldsProps = {
  form: DailySafetyLogFormState;
  weatherLoading: boolean;
  onChange: (patch: Partial<DailySafetyLogFormState>) => void;
};

function DailySafetyLogFormFields({
  form,
  weatherLoading,
  onChange,
}: DailySafetyLogFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FormInput
          label="일지일자"
          type="date"
          value={form.logDate}
          onChange={(event) => onChange({ logDate: event.target.value, weather: "" })}
          required
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">기상</span>
          <input
            readOnly
            value={weatherLoading ? "불러오는 중..." : form.weather}
            placeholder="현장 기상 정보를 불러옵니다."
            className="h-9 w-full rounded-md border border-border bg-background-soft px-3 text-sm text-foreground"
          />
          <p className="text-xs text-foreground-muted">
            {weatherLoading
              ? "현장 Open-Meteo 날씨를 불러오는 중입니다."
              : form.weather
                ? "현장 Open-Meteo 연동값입니다."
                : "선택한 일자의 현장 기상 정보를 찾지 못했습니다."}
          </p>
        </label>
        <FormInput
          label="근무인원"
          type="number"
          min={0}
          value={String(form.workersCount)}
          onChange={(event) => onChange({ workersCount: Number(event.target.value || "0") })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">위험요인</span>
          <textarea
            rows={3}
            value={form.hazards}
            onChange={(event) => onChange({ hazards: event.target.value })}
            className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">조치사항</span>
          <textarea
            rows={3}
            value={form.actions}
            onChange={(event) => onChange({ actions: event.target.value })}
            className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">특이사항</span>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
          />
        </label>
      </div>

      <label className="space-y-1">
        <span className="block text-sm font-medium text-foreground">상태</span>
        <select
          value={form.status}
          onChange={(event) => onChange({ status: event.target.value as Status })}
          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
        >
          <option value="draft">임시저장</option>
          <option value="in_review">검토중</option>
          <option value="approved">승인</option>
          <option value="rejected">반려</option>
          <option value="completed">완료</option>
        </select>
      </label>
    </>
  );
}

export default function SafetyDailyLogPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = hasMinRole(user.role, "manager");

  const [items, setItems] = useState<DailySafetyLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  const [form, setForm] = useState<DailySafetyLogFormState>(createDefaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DailySafetyLogFormState>(createDefaultForm);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreateWeatherLoading, setIsCreateWeatherLoading] = useState(false);
  const [isEditWeatherLoading, setIsEditWeatherLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(
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

        const response = await fetch(`/api/safety/daily-logs?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as DailySafetyLogResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "안전 일지 조회 실패");
        }

        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "안전 일지 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, statusFilter],
  );

  const loadWeatherCondition = useCallback(async (logDate: string, target: "create" | "edit") => {
    if (!logDate) {
      if (target === "create") {
        setForm((prev) => ({ ...prev, weather: "" }));
      } else {
        setEditForm((prev) => ({ ...prev, weather: "" }));
      }
      return;
    }

    if (target === "create") {
      setIsCreateWeatherLoading(true);
    } else {
      setIsEditWeatherLoading(true);
    }

    try {
      const response = await fetch(`/api/safety/daily-logs/weather?date=${encodeURIComponent(logDate)}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { condition?: string };
      };
      const condition = result.ok ? String(result.data?.condition ?? "").trim() : "";

      if (target === "create") {
        setForm((prev) => (prev.logDate === logDate && condition ? { ...prev, weather: condition } : prev));
      } else {
        setEditForm((prev) =>
          prev.logDate === logDate && condition ? { ...prev, weather: condition } : prev,
        );
      }
    } catch {
      if (target === "create") {
        setForm((prev) => (prev.logDate === logDate ? { ...prev, weather: "" } : prev));
      } else {
        setEditForm((prev) => (prev.logDate === logDate ? { ...prev, weather: "" } : prev));
      }
    } finally {
      if (target === "create") {
        setIsCreateWeatherLoading(false);
      } else {
        setIsEditWeatherLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData(1);
  }, [loadData]);

  useEffect(() => {
    void loadWeatherCondition(form.logDate, "create");
  }, [form.logDate, loadWeatherCondition]);

  useEffect(() => {
    if (!editingId) {
      return;
    }
    void loadWeatherCondition(editForm.logDate, "edit");
  }, [editingId, editForm.logDate, loadWeatherCondition]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/safety/daily-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전 일지 등록 실패");
      }

      setForm(createDefaultForm());
      setMessage("안전 일지가 등록되었습니다.");
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전 일지 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePrint(item: DailySafetyLogRow) {
    const printWindow = window.open("", "_blank", "width=980,height=920");
    if (!printWindow) {
      setError("팝업이 차단되어 인쇄 창을 열 수 없습니다.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildPrintHtml(item));
    printWindow.document.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 150);
  }

  function handleOpenEditModal(item: DailySafetyLogRow) {
    if (!canManageLogStatus(item.status)) {
      return;
    }

    setEditingId(item._id);
    setEditForm({
      logDate: item.logDate ? String(item.logDate).slice(0, 10) : getTodayDateInputValue(),
      weather: item.weather ?? "",
      workersCount: item.workersCount ?? 0,
      hazards: item.hazards ?? "",
      actions: item.actions ?? "",
      notes: item.notes ?? "",
      status: item.status ?? "draft",
    });
    setError(null);
    setMessage(null);
  }

  function handleCloseEditModal() {
    if (isUpdating) {
      return;
    }
    setEditingId(null);
    setEditForm(createDefaultForm());
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !canWrite) {
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/safety/daily-logs/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전 일지 수정 실패");
      }

      setEditingId(null);
      setEditForm(createDefaultForm());
      setMessage("안전 일지가 수정되었습니다.");
      await loadData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전 일지 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleOpenDeleteModal(item: DailySafetyLogRow) {
    if (!canManageLogStatus(item.status)) {
      return;
    }

    setDeleteTarget({
      _id: item._id,
      title: new Date(item.logDate).toLocaleDateString("ko-KR"),
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

  async function handleDelete() {
    if (!deleteTarget || !canWrite) {
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/safety/daily-logs/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "안전 일지 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        handleCloseEditModal();
      }
      setDeleteTarget(null);
      setMessage("안전 일지가 삭제되었습니다.");
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전 일지 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<DailySafetyLogRow>[] = [
    {
      key: "logDate",
      header: "일자",
      className: "w-28",
      render: (value) => new Date(String(value)).toLocaleDateString("ko-KR"),
    },
    { key: "weather", header: "기상", className: "w-16" },
    {
      key: "workersCount",
      header: "인원",
      className: "w-20 text-right",
      render: (value) => `${Number(value)}명`,
    },
    { key: "hazards", header: "위험요인" },
    { key: "actions", header: "조치사항" },
    { key: "notes", header: "특이사항" },
    { key: "managerName", header: "관리자", className: "w-24" },
    {
      key: "status",
      header: "상태",
      className: "w-24",
      render: (value) => <StatusBadge status={value as Status} />,
    },
  ];

  if (canWrite) {
    columns.push({
      key: "management",
      header: "관리",
      className: "w-32",
      render: (_value, item) =>
        canManageLogStatus(item.status) ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleOpenEditModal(item)}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => handleOpenDeleteModal(item)}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        ) : (
          <span className="text-xs text-foreground-muted">-</span>
        ),
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">안전 일지</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          안전팀이 일지를 작성하고 현장소장 확인용으로 보고합니다. (현재 시스템 권한상 `manager` 이상 작성 가능)
        </p>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => handlePrint(items[0])}
            className="mt-3 rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm text-foreground hover:bg-background-card"
          >
            최신 일지 인쇄
          </button>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="기상/위험요인/조치/특이사항"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">상태</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | Status)}
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
        <button
          type="button"
          onClick={() => void loadData(1)}
          className="mt-6 rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
        >
          조회
        </button>
      </div>

      {canWrite ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-lg border border-border bg-background-soft p-4"
        >
          <DailySafetyLogFormFields
            form={form}
            weatherLoading={isCreateWeatherLoading}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isCreateWeatherLoading || !form.weather}
              className="rounded-md bg-[#ecebe8] px-4 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "등록"}
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">
          안전 일지 등록은 현재 시스템 권한상 `manager` 이상만 가능합니다.
        </p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {canWrite ? (
        <p className="text-xs text-foreground-muted">임시저장 또는 완료 상태의 일지만 수정하거나 삭제할 수 있습니다.</p>
      ) : null}

      <DataTable
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 안전 일지가 없습니다."}
      />

      <Modal open={Boolean(editingId)} title="안전 일지 수정" onClose={handleCloseEditModal}>
        <form className="space-y-4" onSubmit={handleUpdate}>
          <DailySafetyLogFormFields
            form={editForm}
            weatherLoading={isEditWeatherLoading}
            onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseEditModal}
              disabled={isUpdating}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isUpdating || isEditWeatherLoading || !editForm.weather}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
            >
              {isUpdating ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="안전 일지 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <strong>{deleteTarget?.title}</strong> 일지를 삭제하시겠습니까?
          </p>
          <p className="text-sm text-foreground-muted">삭제 후에는 목록에서 보이지 않습니다.</p>
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
              className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
            >
              {deletingId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadData(nextPage)} />
    </section>
  );
}
