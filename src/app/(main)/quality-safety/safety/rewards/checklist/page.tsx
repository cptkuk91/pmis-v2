"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import {
  DEFAULT_SAFETY_CHECKLIST_CATEGORY,
  SAFETY_CHECKLIST_CATEGORIES,
  normalizeSafetyChecklistCategory,
  type SafetyChecklistCategory,
} from "@/lib/safety-checklist-category";

type ChecklistRow = {
  _id: string;
  title: string;
  checkDate: string;
  inspectorUserId?: string | null;
  inspector: string;
  category: string;
  overallResult: string;
};

type InspectorOption = {
  _id: string;
  name: string;
  email: string;
  role: string;
  membershipRole: string;
};

type ChecklistFormState = {
  title: string;
  checkDate: string;
  inspectorUserId: string;
  inspector: string;
  category: SafetyChecklistCategory;
  overallResult: "" | "pass" | "fail";
};

type DeleteTarget = Pick<ChecklistRow, "_id" | "title">;

const SITE_ID_KEY = "pmis:siteId";
const resultLabel: Record<string, string> = { pass: "합격", fail: "불합격" };
const overallResultOptions = [
  { value: "pass", label: "합격" },
  { value: "fail", label: "불합격" },
] as const;
const membershipRoleLabel: Record<string, string> = {
  site_admin: "현장관리자",
  manager: "관리자",
  viewer: "조회자",
};
const emptyForm = (): ChecklistFormState => ({
  title: "",
  checkDate: getTodayDateInput(),
  inspectorUserId: "",
  inspector: "",
  category: DEFAULT_SAFETY_CHECKLIST_CATEGORY,
  overallResult: "",
});

function getTodayDateInput(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function inspectorLabel(item: InspectorOption | null): string {
  if (item) {
    return item.email ? `${item.name} (${item.email})` : item.name;
  }
  return "";
}

function inspectorLabelWithFallback(item: InspectorOption | null, fallback: string): string {
  return inspectorLabel(item) || fallback;
}

function findUniqueInspectorByName(name: string, options: InspectorOption[]): InspectorOption | null {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }

  const matched = options.filter((item) => item.name.trim().toLowerCase() === normalizedName);
  return matched.length === 1 ? matched[0] : null;
}

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

export default function SafetyChecklistPage() {
  const [data, setData] = useState<ChecklistRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ChecklistFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ChecklistFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [inspectors, setInspectors] = useState<InspectorOption[]>([]);
  const [isInspectorModalOpen, setIsInspectorModalOpen] = useState(false);
  const [inspectorModalTarget, setInspectorModalTarget] = useState<"create" | "edit" | null>(null);
  const [inspectorQuery, setInspectorQuery] = useState("");
  const [isInspectorsLoading, setIsInspectorsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedInspector =
    inspectors.find((item) => item._id === form.inspectorUserId) ?? null;
  const editSelectedInspector =
    inspectors.find((item) => item._id === editForm.inspectorUserId) ?? null;
  const filteredInspectors = inspectors.filter((item) => {
    const keyword = inspectorQuery.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return (
      item.name.toLowerCase().includes(keyword) ||
      item.email.toLowerCase().includes(keyword) ||
      item.role.toLowerCase().includes(keyword) ||
      item.membershipRole.toLowerCase().includes(keyword)
    );
  });

  const fetchData = useCallback((nextPage: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }
    fetch(`/api/safety/checklists?siteId=${siteId}&page=${nextPage}`)
      .then((response) => response.json())
      .then((result) => {
        if (result.ok) {
          setData(result.data);
          setTotalPages(result.meta?.totalPages ?? 1);
        }
      });
  }, []);

  const loadInspectors = useCallback(async () => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }

    setIsInspectorsLoading(true);
    try {
      const response = await fetch(`/api/sites/members?siteId=${siteId}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok: boolean;
        data: InspectorOption[];
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "점검자 목록 조회 실패");
      }
      setInspectors(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "점검자 목록 조회 실패");
    } finally {
      setIsInspectorsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page);
  }, [page, fetchData]);

  useEffect(() => {
    if (!showForm && !editingId) {
      return;
    }
    void loadInspectors();
  }, [showForm, editingId, loadInspectors]);

  useEffect(() => {
    if (!editingId || editForm.inspectorUserId || !editForm.inspector || inspectors.length === 0) {
      return;
    }

    const matchedInspector = findUniqueInspectorByName(editForm.inspector, inspectors);
    if (!matchedInspector) {
      return;
    }

    setEditForm((prev) => {
      if (prev.inspectorUserId || prev.inspector.trim().toLowerCase() !== editForm.inspector.trim().toLowerCase()) {
        return prev;
      }
      return {
        ...prev,
        inspectorUserId: matchedInspector._id,
        inspector: matchedInspector.name,
      };
    });
  }, [editingId, editForm.inspectorUserId, editForm.inspector, inspectors]);

  function handleOpenInspectorModal(target: "create" | "edit") {
    setInspectorModalTarget(target);
    setInspectorQuery("");
    setIsInspectorModalOpen(true);
    if (inspectors.length === 0) {
      void loadInspectors();
    }
  }

  function handleCloseInspectorModal() {
    if (isInspectorsLoading) {
      return;
    }
    setIsInspectorModalOpen(false);
    setInspectorModalTarget(null);
    setInspectorQuery("");
  }

  function handleSelectInspector(item: InspectorOption) {
    if (inspectorModalTarget === "edit") {
      setEditForm((prev) => ({
        ...prev,
        inspectorUserId: item._id,
        inspector: item.name,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        inspectorUserId: item._id,
        inspector: item.name,
      }));
    }
    setIsInspectorModalOpen(false);
    setInspectorModalTarget(null);
    setInspectorQuery("");
  }

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);

    if (!form.overallResult) {
      setError("결과를 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/safety/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          siteId,
          items: [],
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "점검 체크리스트 등록 실패");
      }

      setShowForm(false);
      setForm(emptyForm());
      setMessage("점검 체크리스트가 등록되었습니다.");
      fetchData(1);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "점검 체크리스트 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(row: ChecklistRow) {
    setEditingId(row._id);
    setEditForm({
      title: row.title ?? "",
      checkDate: row.checkDate?.slice(0, 10) ?? getTodayDateInput(),
      inspectorUserId: row.inspectorUserId ?? "",
      inspector: row.inspector ?? "",
      category: normalizeSafetyChecklistCategory(row.category),
      overallResult: row.overallResult === "fail" ? "fail" : "pass",
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
    if (inspectorModalTarget === "edit") {
      setIsInspectorModalOpen(false);
      setInspectorModalTarget(null);
      setInspectorQuery("");
    }
  }

  async function handleUpdate() {
    if (!editingId) {
      return;
    }

    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);

    if (!editForm.overallResult) {
      setError("결과를 선택해 주세요.");
      return;
    }

    setIsUpdating(true);
    try {
      const params = new URLSearchParams({ siteId });
      const response = await fetch(`/api/safety/checklists/${editingId}?${params.toString()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          siteId,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "점검 체크리스트 수정 실패");
      }

      handleCloseEditModal();
      setMessage("점검 체크리스트가 수정되었습니다.");
      fetchData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "점검 체크리스트 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleOpenDeleteModal(row: ChecklistRow) {
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
      const response = await fetch(`/api/safety/checklists/${deleteTarget._id}?${params.toString()}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "점검 체크리스트 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        handleCloseEditModal();
      }
      setDeleteTarget(null);
      setMessage("점검 체크리스트가 삭제되었습니다.");
      fetchData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "점검 체크리스트 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<ChecklistRow>[] = [
    { key: "title", header: "제목" },
    { key: "category", header: "분류", className: "w-36" },
    { key: "inspector", header: "점검자", className: "w-40" },
    {
      key: "checkDate",
      header: "점검일",
      className: "w-28",
      render: (_value, row) => row.checkDate?.slice(0, 10),
    },
    {
      key: "overallResult",
      header: "결과",
      className: "w-20",
      render: (_value, row) => resultLabel[row.overallResult] ?? row.overallResult,
    },
    {
      key: "_id",
      header: "관리",
      className: "w-32",
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleEdit(row)}
            aria-label="점검 체크리스트 수정"
            title="수정"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-border text-foreground hover:bg-background-soft"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={() => handleOpenDeleteModal(row)}
            aria-label="점검 체크리스트 삭제"
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
        <h1 className="text-xl font-semibold text-foreground">점검 체크리스트</h1>
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
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 xl:col-span-2">
              <span className="block text-sm font-medium text-foreground">제목 *</span>
              <input
                className="h-10 w-full rounded-md border border-border px-3 text-sm"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">분류 *</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    category: event.target.value as SafetyChecklistCategory,
                  }))
                }
              >
                {SAFETY_CHECKLIST_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">점검일 *</span>
              <input
                type="date"
                className="h-10 w-full rounded-md border border-border px-3 text-sm"
                value={form.checkDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, checkDate: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">결과 *</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={form.overallResult}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    overallResult: event.target.value as ChecklistFormState["overallResult"],
                  }))
                }
              >
                <option value="">결과 선택</option>
                {overallResultOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2 xl:col-span-5">
              <span className="block text-sm font-medium text-foreground">점검자 *</span>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  readOnly
                  className="h-10 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  value={inspectorLabel(selectedInspector)}
                  placeholder="현장 점검자를 선택해 주세요."
                />
                <div className="flex gap-2">
                  <button
                  type="button"
                    onClick={() => handleOpenInspectorModal("create")}
                    className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                  >
                    점검자 선택
                  </button>
                  {form.inspectorUserId ? (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          inspectorUserId: "",
                          inspector: "",
                        }))
                      }
                      className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                    >
                      초기화
                    </button>
                  ) : null}
                </div>
              </div>
              {selectedInspector ? (
                <p className="text-xs text-foreground-muted">
                  {selectedInspector.email}
                  {selectedInspector.membershipRole
                    ? ` · ${membershipRoleLabel[selectedInspector.membershipRole] ?? selectedInspector.membershipRole}`
                    : ""}
                </p>
              ) : null}
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

      <Modal open={Boolean(editingId)} title="점검 체크리스트 수정" onClose={handleCloseEditModal}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleUpdate();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="block text-sm font-medium text-foreground">제목 *</span>
              <input
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.title}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">분류 *</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={editForm.category}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    category: event.target.value as SafetyChecklistCategory,
                  }))
                }
              >
                {SAFETY_CHECKLIST_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">점검일 *</span>
              <input
                type="date"
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                value={editForm.checkDate}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, checkDate: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">결과 *</span>
              <select
                className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                value={editForm.overallResult}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    overallResult: event.target.value as ChecklistFormState["overallResult"],
                  }))
                }
              >
                <option value="">결과 선택</option>
                {overallResultOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="block text-sm font-medium text-foreground">점검자 *</span>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  readOnly
                  className="h-10 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  value={inspectorLabelWithFallback(editSelectedInspector, editForm.inspector)}
                  placeholder="현장 점검자를 선택해 주세요."
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenInspectorModal("edit")}
                    className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                  >
                    점검자 선택
                  </button>
                  {editForm.inspectorUserId ? (
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          inspectorUserId: "",
                          inspector: "",
                        }))
                      }
                      className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                    >
                      초기화
                    </button>
                  ) : null}
                </div>
              </div>
              {editSelectedInspector ? (
                <p className="text-xs text-foreground-muted">
                  {editSelectedInspector.email}
                  {editSelectedInspector.membershipRole
                    ? ` · ${membershipRoleLabel[editSelectedInspector.membershipRole] ?? editSelectedInspector.membershipRole}`
                    : ""}
                </p>
              ) : null}
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

      <Modal open={Boolean(deleteTarget)} title="점검 체크리스트 삭제" onClose={handleCloseDeleteModal}>
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

      <Modal open={isInspectorModalOpen} title="현장 점검자 선택" onClose={handleCloseInspectorModal}>
        <div className="space-y-4">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">검색</span>
            <input
              className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
              value={inspectorQuery}
              onChange={(event) => setInspectorQuery(event.target.value)}
              placeholder="이름, 이메일, 권한으로 검색"
            />
          </label>

          <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-2">
            {filteredInspectors.length > 0 ? (
              filteredInspectors.map((item) => {
                const currentInspectorUserId =
                  inspectorModalTarget === "edit" ? editForm.inspectorUserId : form.inspectorUserId;
                const isSelected = currentInspectorUserId === item._id;
                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => handleSelectInspector(item)}
                    className={`flex w-full items-start justify-between rounded-md border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-border-strong bg-background-card"
                        : "border-transparent hover:border-border hover:bg-background-card"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium text-foreground">{item.name}</span>
                      <span className="block text-xs text-foreground-muted">{item.email}</span>
                    </span>
                    <span className="text-right text-xs text-foreground-muted">
                      <span className="block">
                        {membershipRoleLabel[item.membershipRole] ?? item.membershipRole}
                      </span>
                      <span className="block">{item.role}</span>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-6 text-center text-sm text-foreground-muted">
                {isInspectorsLoading ? "점검자 목록을 불러오는 중..." : "조회된 현장 점검자가 없습니다."}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCloseInspectorModal}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              닫기
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
