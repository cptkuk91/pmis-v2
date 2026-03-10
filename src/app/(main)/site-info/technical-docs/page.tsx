"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { Modal } from "@/components/ui/modal";

type PlanRow = {
  _id: string;
  title: string;
  category: string;
  description: string;
  version: string;
  createdAt: string;
  actions?: string;
};

type SpecRow = {
  _id: string;
  title: string;
  category: string;
  description: string;
  version: string;
  effectiveDate: string;
  createdAt: string;
  actions?: string;
};

type MethodRow = {
  _id: string;
  title: string;
  workType: string;
  description: string;
  createdAt: string;
  actions?: string;
};

type PlanFormState = {
  title: string;
  category: string;
  description: string;
  version: string;
};

type SpecFormState = {
  title: string;
  category: string;
  description: string;
  version: string;
  effectiveDate: string;
};

type MethodFormState = {
  title: string;
  workType: string;
  description: string;
};

type DeleteTarget = {
  _id: string;
  title: string;
  tab: TabKey;
};

const SITE_ID_KEY = "pmis:siteId";

const tabs = [
  { key: "plans", label: "시공계획" },
  { key: "specs", label: "시방서" },
  { key: "methods", label: "주요공법" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

const apiPath: Record<TabKey, string> = {
  plans: "/api/sites/construction-plans",
  specs: "/api/sites/specifications",
  methods: "/api/sites/methods",
};

function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateKorean(value: string): string {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return "";
  }

  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

const createDefaultForms = {
  plans: (): PlanFormState => ({ title: "", category: "", description: "", version: "" }),
  specs: (): SpecFormState => ({
    title: "",
    category: "",
    description: "",
    version: "",
    effectiveDate: getTodayDateInputValue(),
  }),
  methods: (): MethodFormState => ({ title: "", workType: "", description: "" }),
};

const dateKR = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString("ko-KR") : "-");

const planBaseColumns: DataTableColumn<PlanRow>[] = [
  { key: "title", header: "제목" },
  { key: "category", header: "구분", className: "w-24" },
  { key: "version", header: "버전", className: "w-20" },
  { key: "description", header: "설명" },
  { key: "createdAt", header: "등록일", className: "w-28", render: (value) => dateKR(value) },
];

const specBaseColumns: DataTableColumn<SpecRow>[] = [
  { key: "title", header: "제목" },
  { key: "category", header: "구분", className: "w-24" },
  { key: "version", header: "버전", className: "w-20" },
  { key: "effectiveDate", header: "적용일", className: "w-28", render: (value) => dateKR(value) },
  { key: "createdAt", header: "등록일", className: "w-28", render: (value) => dateKR(value) },
];

const methodBaseColumns: DataTableColumn<MethodRow>[] = [
  { key: "title", header: "공법명" },
  { key: "workType", header: "공종", className: "w-24" },
  { key: "description", header: "설명" },
  { key: "createdAt", header: "등록일", className: "w-28", render: (value) => dateKR(value) },
];

function buildActionColumn<T extends { _id: string }>(
  onEdit: (row: T) => void,
  onDelete: (row: T) => void,
): DataTableColumn<T> {
  return {
    key: "actions" as keyof T,
    header: "관리",
    className: "w-32",
    render: (_value, row) => (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(row)}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
        >
          수정
        </button>
        <button
          type="button"
          onClick={() => onDelete(row)}
          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          삭제
        </button>
      </div>
    ),
  };
}

function getEditTitle(tab: TabKey): string {
  if (tab === "plans") {
    return "시공계획 수정";
  }
  if (tab === "specs") {
    return "시방서 수정";
  }
  return "주요공법 수정";
}

function getDeleteTitle(tab: TabKey): string {
  if (tab === "plans") {
    return "시공계획 삭제";
  }
  if (tab === "specs") {
    return "시방서 삭제";
  }
  return "주요공법 삭제";
}

export default function TechnicalDocsPage() {
  const [tab, setTab] = useState<TabKey>("plans");
  const [data, setData] = useState<unknown[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [planForm, setPlanForm] = useState<PlanFormState>(createDefaultForms.plans);
  const [specForm, setSpecForm] = useState<SpecFormState>(createDefaultForms.specs);
  const [methodForm, setMethodForm] = useState<MethodFormState>(createDefaultForms.methods);
  const [editPlanForm, setEditPlanForm] = useState<PlanFormState>(createDefaultForms.plans);
  const [editSpecForm, setEditSpecForm] = useState<SpecFormState>(createDefaultForms.specs);
  const [editMethodForm, setEditMethodForm] = useState<MethodFormState>(createDefaultForms.methods);

  const fetchData = useCallback((nextPage: number, nextTab: TabKey) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      return;
    }

    fetch(`${apiPath[nextTab]}?siteId=${siteId}&page=${nextPage}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (!result.ok) {
          throw new Error(result.error ?? "기술 문서 조회 실패");
        }

        setData(Array.isArray(result.data) ? result.data : []);
        setTotalPages(result.meta?.totalPages ?? 1);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "기술 문서 조회 실패");
      });
  }, []);

  useEffect(() => {
    setError(null);
    fetchData(page, tab);
  }, [page, tab, fetchData]);

  function resetCreateForm(targetTab: TabKey) {
    if (targetTab === "plans") {
      setPlanForm(createDefaultForms.plans());
      return;
    }
    if (targetTab === "specs") {
      setSpecForm(createDefaultForms.specs());
      return;
    }
    setMethodForm(createDefaultForms.methods());
  }

  function resetEditForm(targetTab: TabKey) {
    if (targetTab === "plans") {
      setEditPlanForm(createDefaultForms.plans());
      return;
    }
    if (targetTab === "specs") {
      setEditSpecForm(createDefaultForms.specs());
      return;
    }
    setEditMethodForm(createDefaultForms.methods());
  }

  function handleTabChange(key: TabKey) {
    setTab(key);
    setPage(1);
    setShowForm(false);
    setEditingId(null);
    setDeleteTarget(null);
    setError(null);
    setMessage(null);
    resetCreateForm(key);
    resetEditForm(key);
  }

  function handleToggleCreateForm() {
    setError(null);
    setMessage(null);

    if (showForm) {
      resetCreateForm(tab);
      setShowForm(false);
      return;
    }

    setShowForm(true);
  }

  function handleOpenEditPlan(row: PlanRow) {
    setEditPlanForm({
      title: row.title ?? "",
      category: row.category ?? "",
      description: row.description ?? "",
      version: row.version ?? "",
    });
    setShowForm(false);
    setEditingId(row._id);
    setError(null);
    setMessage(null);
  }

  function handleOpenEditSpec(row: SpecRow) {
    setEditSpecForm({
      title: row.title ?? "",
      category: row.category ?? "",
      description: row.description ?? "",
      version: row.version ?? "",
      effectiveDate: row.effectiveDate ? String(row.effectiveDate).slice(0, 10) : "",
    });
    setShowForm(false);
    setEditingId(row._id);
    setError(null);
    setMessage(null);
  }

  function handleOpenEditMethod(row: MethodRow) {
    setEditMethodForm({
      title: row.title ?? "",
      workType: row.workType ?? "",
      description: row.description ?? "",
    });
    setShowForm(false);
    setEditingId(row._id);
    setError(null);
    setMessage(null);
  }

  function handleCloseEditModal() {
    if (isUpdating) {
      return;
    }
    setEditingId(null);
    resetEditForm(tab);
  }

  function handleOpenDeleteModal(itemId: string, title: string) {
    setDeleteTarget({ _id: itemId, title, tab });
    setError(null);
    setMessage(null);
  }

  function handleCloseDeleteModal() {
    if (deletingId) {
      return;
    }
    setDeleteTarget(null);
  }

  async function handleCreate() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }

    const body = tab === "plans" ? planForm : tab === "specs" ? specForm : methodForm;

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(apiPath[tab], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, siteId }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "기술 문서 저장 실패");
      }

      setShowForm(false);
      resetCreateForm(tab);
      setMessage("기술 문서가 등록되었습니다.");
      fetchData(1, tab);
      setPage(1);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "기술 문서 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }
    if (!editingId) {
      return;
    }

    const body = tab === "plans" ? editPlanForm : tab === "specs" ? editSpecForm : editMethodForm;

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${apiPath[tab]}/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, siteId }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "기술 문서 수정 실패");
      }

      setEditingId(null);
      resetEditForm(tab);
      setMessage("기술 문서가 수정되었습니다.");
      fetchData(page, tab);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "기술 문서 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }
    if (!deleteTarget) {
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${apiPath[deleteTarget.tab]}/${deleteTarget._id}?siteId=${siteId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "기술 문서 삭제 실패");
      }

      setDeleteTarget(null);
      setMessage("기술 문서가 삭제되었습니다.");
      fetchData(1, deleteTarget.tab);
      setPage(1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "기술 문서 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const planColumns = [
    ...planBaseColumns,
    buildActionColumn<PlanRow>(handleOpenEditPlan, (row) => handleOpenDeleteModal(row._id, row.title)),
  ];
  const specColumns = [
    ...specBaseColumns,
    buildActionColumn<SpecRow>(handleOpenEditSpec, (row) => handleOpenDeleteModal(row._id, row.title)),
  ];
  const methodColumns = [
    ...methodBaseColumns,
    buildActionColumn<MethodRow>(handleOpenEditMethod, (row) => handleOpenDeleteModal(row._id, row.title)),
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">기술 문서</h1>
        <button
          type="button"
          onClick={handleToggleCreateForm}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleTabChange(item.key)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
              tab === item.key
                ? "bg-[#ecebe8] font-medium text-foreground"
                : "text-foreground-muted hover:bg-background-soft"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showForm && tab === "plans" ? (
        <div className="space-y-3 rounded-lg border border-border bg-background-card p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">제목 *</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={planForm.title}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">구분</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={planForm.category}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, category: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">버전</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={planForm.version}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, version: event.target.value }))}
                placeholder="v1.0"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">설명</label>
            <textarea
              className="min-h-20 w-full rounded-md border border-border p-3 text-sm"
              value={planForm.description}
              onChange={(event) => setPlanForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : null}

      {showForm && tab === "specs" ? (
        <div className="space-y-3 rounded-lg border border-border bg-background-card p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">제목 *</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={specForm.title}
                onChange={(event) => setSpecForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">구분</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={specForm.category}
                onChange={(event) => setSpecForm((prev) => ({ ...prev, category: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">버전</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={specForm.version}
                onChange={(event) => setSpecForm((prev) => ({ ...prev, version: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">적용일</label>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={specForm.effectiveDate}
                onChange={(event) => setSpecForm((prev) => ({ ...prev, effectiveDate: event.target.value }))}
              />
              <p className="text-xs text-foreground-muted">{formatDateKorean(specForm.effectiveDate)}</p>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">설명</label>
            <textarea
              className="min-h-20 w-full rounded-md border border-border p-3 text-sm"
              value={specForm.description}
              onChange={(event) => setSpecForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : null}

      {showForm && tab === "methods" ? (
        <div className="space-y-3 rounded-lg border border-border bg-background-card p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">공법명 *</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={methodForm.title}
                onChange={(event) => setMethodForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">공종</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={methodForm.workType}
                onChange={(event) => setMethodForm((prev) => ({ ...prev, workType: event.target.value }))}
                placeholder="토목, 건축, 기전 등"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">설명</label>
            <textarea
              className="min-h-20 w-full rounded-md border border-border p-3 text-sm"
              value={methodForm.description}
              onChange={(event) => setMethodForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "plans" ? <DataTable columns={planColumns} data={data as PlanRow[]} rowKey={(row) => row._id} /> : null}
      {tab === "specs" ? <DataTable columns={specColumns} data={data as SpecRow[]} rowKey={(row) => row._id} /> : null}
      {tab === "methods" ? <DataTable columns={methodColumns} data={data as MethodRow[]} rowKey={(row) => row._id} /> : null}
      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal open={Boolean(editingId)} title={getEditTitle(tab)} onClose={handleCloseEditModal}>
        {tab === "plans" ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleUpdate();
            }}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">제목 *</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                  value={editPlanForm.title}
                  onChange={(event) => setEditPlanForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">구분</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                  value={editPlanForm.category}
                  onChange={(event) => setEditPlanForm((prev) => ({ ...prev, category: event.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">버전</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                  value={editPlanForm.version}
                  onChange={(event) => setEditPlanForm((prev) => ({ ...prev, version: event.target.value }))}
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="block text-sm font-medium text-foreground">설명</span>
                <textarea
                  className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm"
                  rows={5}
                  value={editPlanForm.description}
                  onChange={(event) => setEditPlanForm((prev) => ({ ...prev, description: event.target.value }))}
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
        ) : null}

        {tab === "specs" ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleUpdate();
            }}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">제목 *</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                  value={editSpecForm.title}
                  onChange={(event) => setEditSpecForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">구분</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                  value={editSpecForm.category}
                  onChange={(event) => setEditSpecForm((prev) => ({ ...prev, category: event.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">버전</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                  value={editSpecForm.version}
                  onChange={(event) => setEditSpecForm((prev) => ({ ...prev, version: event.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">적용일</span>
                <input
                  type="date"
                  className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                  value={editSpecForm.effectiveDate}
                  onChange={(event) => setEditSpecForm((prev) => ({ ...prev, effectiveDate: event.target.value }))}
                />
                <span className="block text-xs text-foreground-muted">{formatDateKorean(editSpecForm.effectiveDate)}</span>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="block text-sm font-medium text-foreground">설명</span>
                <textarea
                  className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm"
                  rows={5}
                  value={editSpecForm.description}
                  onChange={(event) => setEditSpecForm((prev) => ({ ...prev, description: event.target.value }))}
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
        ) : null}

        {tab === "methods" ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleUpdate();
            }}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">공법명 *</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                  value={editMethodForm.title}
                  onChange={(event) => setEditMethodForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">공종</span>
                <input
                  className="h-10 w-full rounded-md border border-border bg-background-card px-3 text-sm"
                  value={editMethodForm.workType}
                  onChange={(event) => setEditMethodForm((prev) => ({ ...prev, workType: event.target.value }))}
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="block text-sm font-medium text-foreground">설명</span>
                <textarea
                  className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm"
                  rows={5}
                  value={editMethodForm.description}
                  onChange={(event) => setEditMethodForm((prev) => ({ ...prev, description: event.target.value }))}
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
        ) : null}
      </Modal>

      <Modal open={Boolean(deleteTarget)} title={getDeleteTitle(deleteTarget?.tab ?? tab)} onClose={handleCloseDeleteModal}>
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
              className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
            >
              {deletingId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
