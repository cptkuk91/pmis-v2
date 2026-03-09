"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import {
  ACCIDENT_TYPES,
  DEFAULT_ACCIDENT_TYPE,
  type AccidentType,
} from "@/lib/accident-type";

type Severity = "minor" | "moderate" | "serious" | "fatal";
type CompletionStatus = "reported" | "investigating" | "closed";

type Row = {
  _id: string;
  accidentDate: string;
  accidentType: AccidentType;
  location: string;
  description: string;
  injuredName: string;
  injuredCompany: string;
  severity: Severity;
  actionTaken: string;
  status: CompletionStatus;
};

type FormState = {
  accidentType: AccidentType;
  accidentDate: string;
  location: string;
  injuredName: string;
  injuredCompany: string;
  severity: Severity;
  description: string;
  status: CompletionStatus;
};

type DeleteTarget = {
  _id: string;
  title: string;
};

const SITE_ID_KEY = "pmis:siteId";
const severityLabel: Record<Severity, string> = {
  minor: "경미",
  moderate: "보통",
  serious: "중대",
  fatal: "사망",
};
const statusLabel: Record<CompletionStatus, string> = {
  reported: "보고",
  investigating: "조사 중",
  closed: "종결",
};
const severityOptions: Array<{ value: Severity; label: string }> = [
  { value: "minor", label: "경미" },
  { value: "moderate", label: "보통" },
  { value: "serious", label: "중대" },
  { value: "fatal", label: "사망" },
];
const statusOptions: Array<{ value: CompletionStatus; label: string }> = [
  { value: "reported", label: "보고" },
  { value: "investigating", label: "조사 중" },
  { value: "closed", label: "종결" },
];

const emptyForm = (): FormState => ({
  accidentType: DEFAULT_ACCIDENT_TYPE,
  accidentDate: "",
  location: "",
  injuredName: "",
  injuredCompany: "",
  severity: "minor",
  description: "",
  status: "reported",
});

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M4.167 13.333V15.833H6.667L14.042 8.458A1.178 1.178 0 0 0 14.042 6.792L13.208 5.958A1.178 1.178 0 0 0 11.542 5.958L4.167 13.333Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10.833 6.667L13.333 9.167"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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

export default function SafetyManagementCompletionPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }
    fetch(`/api/safety/completion?siteId=${siteId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) {
          setRows(Array.isArray(result.data) ? result.data : []);
        }
      })
      .catch(() => {
        setError("사고/조치 이력 조회 실패");
      });
  }, []);

  useEffect(() => {
    setError(null);
    fetchData();
  }, [fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/safety/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          siteId,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "사고/조치 이력 등록 실패");
      }

      setShowForm(false);
      setForm(emptyForm());
      setMessage("사고/조치 이력이 등록되었습니다.");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "사고/조치 이력 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(row: Row) {
    setEditingId(row._id);
    setEditForm({
      accidentType: row.accidentType,
      accidentDate: row.accidentDate?.slice(0, 10) ?? "",
      location: row.location ?? "",
      injuredName: row.injuredName ?? "",
      injuredCompany: row.injuredCompany ?? "",
      severity: row.severity ?? "minor",
      description: row.description ?? "",
      status: row.status ?? "reported",
    });
    setError(null);
    setMessage(null);
  }

  function handleCloseEditModal() {
    if (isUpdating) {
      return;
    }
    setEditingId(null);
    setEditForm(emptyForm());
  }

  async function handleUpdate() {
    if (!editingId) {
      return;
    }

    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/safety/completion/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          siteId,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "사고/조치 이력 수정 실패");
      }

      handleCloseEditModal();
      setMessage("사고/조치 이력이 수정되었습니다.");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "사고/조치 이력 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleOpenDeleteModal(row: Row) {
    setDeleteTarget({
      _id: row._id,
      title: row.injuredName ? `${row.injuredName} / ${row.accidentType}` : row.accidentType,
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
    if (!deleteTarget) {
      return;
    }

    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);
    setDeletingId(deleteTarget._id);

    try {
      const params = new URLSearchParams({ siteId });
      const response = await fetch(
        `/api/safety/completion/${deleteTarget._id}?${params.toString()}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "사고/조치 이력 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        handleCloseEditModal();
      }
      setDeleteTarget(null);
      setMessage("사고/조치 이력이 삭제되었습니다.");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "사고/조치 이력 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<Row>[] = [
    {
      key: "accidentDate",
      header: "일자",
      className: "w-28",
      render: (_value, row) => row.accidentDate?.slice(0, 10),
    },
    { key: "accidentType", header: "유형", className: "w-28" },
    { key: "location", header: "장소" },
    { key: "injuredName", header: "피해자", className: "w-28" },
    {
      key: "severity",
      header: "심각도",
      className: "w-20",
      render: (_value, row) => severityLabel[row.severity] ?? row.severity,
    },
    {
      key: "status",
      header: "상태",
      className: "w-24",
      render: (_value, row) => statusLabel[row.status] ?? row.status,
    },
    {
      key: "_id",
      header: "관리",
      className: "w-28",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            aria-label="사고/조치 이력 수정"
            title="수정"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-foreground hover:bg-background-soft"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => handleOpenDeleteModal(row)}
            aria-label="사고/조치 이력 삭제"
            title="삭제"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-danger/40 text-danger hover:bg-danger/10"
          >
            <DeleteIcon />
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">사고/조치 이력</h1>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <form
          className="space-y-3 rounded-lg border border-border bg-background-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">유형 *</span>
              <select
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.accidentType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    accidentType: event.target.value as AccidentType,
                  }))
                }
              >
                {ACCIDENT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">일자</span>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.accidentDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, accidentDate: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">장소</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">피해자</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.injuredName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, injuredName: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">소속</span>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.injuredCompany}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, injuredCompany: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">심각도</span>
              <select
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.severity}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    severity: event.target.value as Severity,
                  }))
                }
              >
                {severityOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">내용</span>
            <textarea
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      ) : null}

      <DataTable columns={columns} data={rows} rowKey={(row) => row._id} />

      <Modal open={Boolean(editingId)} title="사고/조치 이력 수정" onClose={handleCloseEditModal}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleUpdate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">유형 *</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={editForm.accidentType}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    accidentType: event.target.value as AccidentType,
                  }))
                }
              >
                {ACCIDENT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">일자</span>
              <input
                type="date"
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.accidentDate}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, accidentDate: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">장소</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.location}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, location: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">피해자</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.injuredName}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, injuredName: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">소속</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.injuredCompany}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, injuredCompany: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">심각도</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={editForm.severity}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    severity: event.target.value as Severity,
                  }))
                }
              >
                {severityOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="block text-sm font-medium text-foreground">상태 *</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={editForm.status}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    status: event.target.value as CompletionStatus,
                  }))
                }
              >
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="block text-sm font-medium text-foreground">내용</span>
              <textarea
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm"
                rows={4}
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </label>
          </div>
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
              disabled={isUpdating}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
            >
              {isUpdating ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="사고/조치 이력 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <strong>{deleteTarget?.title}</strong> 항목을 삭제하시겠습니까?
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
              className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
            >
              {deletingId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
