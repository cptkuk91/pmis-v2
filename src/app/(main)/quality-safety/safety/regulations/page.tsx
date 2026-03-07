"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import {
  DEFAULT_SAFETY_REGULATION_CATEGORY,
  SAFETY_REGULATION_CATEGORIES,
  type SafetyRegulationCategory,
  normalizeSafetyRegulationCategory,
} from "@/lib/safety-regulation-category";

type RegulationRow = {
  _id: string;
  category: string;
  title: string;
  content: string;
  reference: string;
  sortOrder: number;
};

type RegulationFormState = {
  category: SafetyRegulationCategory;
  title: string;
  content: string;
  reference: string;
  sortOrder: string;
};

type RegulationDeleteTarget = Pick<RegulationRow, "_id" | "category" | "title">;

const SITE_ID_KEY = "pmis:siteId";
const emptyForm: RegulationFormState = {
  category: DEFAULT_SAFETY_REGULATION_CATEGORY,
  title: "",
  content: "",
  reference: "",
  sortOrder: "0",
};

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
      <path d="M5.833 6.667V14.167C5.833 14.627 6.206 15 6.667 15H13.333C13.794 15 14.167 14.627 14.167 14.167V6.667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.167 5H15.833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.333 5V4.167C8.333 3.707 8.706 3.333 9.167 3.333H10.833C11.294 3.333 11.667 3.707 11.667 4.167V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8.333 8.333V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.667 8.333V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function SafetyRegulationsPage() {
  const [data, setData] = useState<RegulationRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RegulationFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RegulationFormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RegulationDeleteTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback((p: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) return;
    fetch(`/api/safety/regulations?siteId=${siteId}&page=${p}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) {
          setData(res.data);
          setTotalPages(res.meta?.totalPages ?? 1);
        }
      });
  }, []);
  useEffect(() => { fetchData(page); }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/safety/regulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          siteId,
          sortOrder: Number(form.sortOrder) || 0,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error ?? "안전 규정 등록 실패");
      }
      setShowForm(false);
      setForm(emptyForm);
      setMessage("안전 규정이 등록되었습니다.");
      fetchData(1);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전 규정 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(row: RegulationRow) {
    setEditingId(row._id);
    setEditForm({
      category: normalizeSafetyRegulationCategory(row.category),
      title: row.title ?? "",
      content: row.content ?? "",
      reference: row.reference ?? "",
      sortOrder: String(row.sortOrder ?? 0),
    });
    setError(null);
    setMessage(null);
  }

  function handleCancelEdit() {
    if (isUpdating) {
      return;
    }
    setEditingId(null);
    setEditForm(emptyForm);
  }

  function handleOpenDeleteModal(row: RegulationRow) {
    setDeleteTarget({
      _id: row._id,
      category: row.category,
      title: row.title,
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

  async function handleUpdate() {
    if (!editingId) {
      return;
    }

    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/safety/regulations/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          siteId,
          sortOrder: Number(editForm.sortOrder) || 0,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error ?? "안전 규정 수정 실패");
      }
      setEditingId(null);
      setEditForm(emptyForm);
      setMessage("안전 규정이 수정되었습니다.");
      fetchData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전 규정 수정 실패");
    } finally {
      setIsUpdating(false);
    }
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
      const res = await fetch(`/api/safety/regulations/${deleteTarget._id}?${params.toString()}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error ?? "안전 규정 삭제 실패");
      }
      if (editingId === deleteTarget._id) {
        handleCancelEdit();
      }
      setDeleteTarget(null);
      setMessage("안전 규정이 삭제되었습니다.");
      fetchData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전 규정 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<RegulationRow>[] = [
    {
      key: "category",
      header: "분류",
      className: "w-36",
      render: (_, row) => row.category,
    },
    {
      key: "title",
      header: "제목",
      className: "min-w-[220px]",
      render: (_, row) => row.title,
    },
    {
      key: "content",
      header: "내용",
      className: "min-w-[280px]",
      render: (_, row) => row.content?.slice(0, 50),
    },
    {
      key: "reference",
      header: "참조",
      className: "w-40",
      render: (_, row) => row.reference,
    },
    {
      key: "sortOrder",
      header: "순서",
      className: "w-24",
      render: (_, row) => row.sortOrder,
    },
    {
      key: "_id",
      header: "관리",
      className: "w-32",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            aria-label="안전 규정 수정"
            title="수정"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-foreground hover:bg-background-soft"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => handleOpenDeleteModal(row)}
            aria-label="안전 규정 삭제"
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
        <h1 className="text-xl font-semibold text-foreground">안전기준</h1>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]">{showForm ? "취소" : "등록"}</button>
      </div>
      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {showForm && (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">분류 *</label>
              <select
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: normalizeSafetyRegulationCategory(e.target.value) })
                }
              >
                {SAFETY_REGULATION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">제목 *</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-1"><label className="block text-sm font-medium text-foreground">참조</label><input className="h-9 w-full rounded-md border border-border px-3 text-sm" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">순서</label>
              <input
                type="number"
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </div>
            <div className="space-y-1 md:col-span-2 xl:col-span-4"><label className="block text-sm font-medium text-foreground">내용</label><textarea className="w-full rounded-md border border-border px-3 py-2 text-sm" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting} className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60">{isSubmitting ? "저장 중..." : "저장"}</button></div>
        </div>
      )}
      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
      <Modal open={Boolean(editingId)} title="안전 규정 수정" onClose={handleCancelEdit}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">분류 *</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={editForm.category}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    category: normalizeSafetyRegulationCategory(event.target.value),
                  }))
                }
              >
                {SAFETY_REGULATION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">제목 *</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">참조</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.reference}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, reference: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">순서</span>
              <input
                type="number"
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.sortOrder}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, sortOrder: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="block text-sm font-medium text-foreground">내용</span>
              <textarea
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm"
                rows={6}
                value={editForm.content}
                onChange={(event) => setEditForm((prev) => ({ ...prev, content: event.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isUpdating}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleUpdate()}
              disabled={isUpdating}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
            >
              {isUpdating ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={Boolean(deleteTarget)} title="안전 규정 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <strong>{deleteTarget?.title}</strong>
            {deleteTarget?.category ? ` (${deleteTarget.category})` : ""} 규정을 삭제하시겠습니까?
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
