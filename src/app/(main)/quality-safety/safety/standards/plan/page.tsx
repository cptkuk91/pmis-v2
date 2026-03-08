"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";

type DocRow = {
  _id: string;
  title: string;
  description: string;
  status: string;
  version: number;
};

type DocFormState = {
  title: string;
  description: string;
};

type DeleteTarget = Pick<DocRow, "_id" | "title">;

const SITE_ID_KEY = "pmis:siteId";
const statusLabel: Record<string, string> = {
  draft: "초안",
  in_review: "검토중",
  approved: "승인",
  rejected: "반려",
};
const emptyForm: DocFormState = {
  title: "",
  description: "",
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

export default function SafetyPlanPage() {
  const [data, setData] = useState<DocRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DocFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DocFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback((nextPage: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }

    fetch(`/api/safety/standards?siteId=${siteId}&docType=plan&page=${nextPage}`)
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) {
          setData(result.data);
          setTotalPages(result.meta?.totalPages ?? 1);
        }
      });
  }, []);

  useEffect(() => {
    fetchData(page);
  }, [page, fetchData]);

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/safety/standards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          siteId,
          docType: "plan",
        }),
      });
      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error ?? "안전관리계획서 등록 실패");
      }

      setShowForm(false);
      setForm(emptyForm);
      setMessage("안전관리계획서가 등록되었습니다.");
      fetchData(1);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전관리계획서 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(row: DocRow) {
    setEditingId(row._id);
    setEditForm({
      title: row.title ?? "",
      description: row.description ?? "",
    });
    setError(null);
    setMessage(null);
  }

  function handleCloseEditModal() {
    if (isUpdating) {
      return;
    }
    setEditingId(null);
    setEditForm(emptyForm);
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
      const response = await fetch(`/api/safety/standards/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          siteId,
        }),
      });
      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error ?? "안전관리계획서 수정 실패");
      }

      handleCloseEditModal();
      setMessage("안전관리계획서가 수정되었습니다.");
      fetchData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전관리계획서 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleOpenDeleteModal(row: DocRow) {
    setDeleteTarget({
      _id: row._id,
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
      const response = await fetch(`/api/safety/standards/${deleteTarget._id}?${params.toString()}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error ?? "안전관리계획서 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        handleCloseEditModal();
      }
      setDeleteTarget(null);
      setMessage("안전관리계획서가 삭제되었습니다.");
      fetchData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "안전관리계획서 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<DocRow>[] = [
    { key: "title", header: "제목" },
    {
      key: "description",
      header: "설명",
      render: (_value, row) => row.description?.slice(0, 40),
    },
    {
      key: "status",
      header: "상태",
      className: "w-20",
      render: (_value, row) => statusLabel[row.status] ?? row.status,
    },
    { key: "version", header: "버전", className: "w-16" },
    {
      key: "_id",
      header: "관리",
      className: "w-32",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            aria-label="안전관리계획서 수정"
            title="수정"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-foreground hover:bg-background-soft"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => handleOpenDeleteModal(row)}
            aria-label="안전관리계획서 삭제"
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
        <h1 className="text-xl font-semibold text-foreground">안전관리계획서</h1>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">제목 *</span>
              <input
                className="h-10 w-full rounded-md border border-border px-3 text-sm"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">설명</span>
              <textarea
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : null}

      <DataTable columns={columns} data={data} rowKey={(row) => row._id} />
      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal open={Boolean(editingId)} title="안전관리계획서 수정" onClose={handleCloseEditModal}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleUpdate();
          }}
        >
          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">제목 *</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.title}
                onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">설명</span>
              <textarea
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm"
                rows={6}
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

      <Modal open={Boolean(deleteTarget)} title="안전관리계획서 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <strong>{deleteTarget?.title}</strong> 문서를 삭제하시겠습니까?
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
