"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QaFeedbackBanners } from "@/components/qa/feedback-banners";
import { QaFilterPanel } from "@/components/qa/filter-panel";
import { QaSortSelect } from "@/components/qa/sort-select";
import { DataTable, FileUpload, FormInput, Modal, Pagination } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import { buildUploadUrl } from "@/lib/file-asset-url";
import {
  QA_PROCEDURE_DOCUMENT_TYPE_LABELS,
  QA_PROCEDURE_DOCUMENT_TYPE_VALUES,
  QA_PROCEDURE_REFERENCE_TARGET_LABELS,
  QA_PROCEDURE_REFERENCE_TARGET_VALUES,
  QA_PROCEDURE_SCOPE_TYPE_LABELS,
  QA_PROCEDURE_SCOPE_TYPE_VALUES,
  QA_PROCEDURE_STATUS_LABELS,
  QA_PROCEDURE_STATUS_VALUES,
  type QaProcedureDocumentType,
  type QaProcedureReferenceTarget,
  type QaProcedureScopeType,
  type QaProcedureStatus,
} from "@/lib/qa-procedures";

type ProcedureItem = {
  _id: string;
  documentKey: string;
  categoryCode: string;
  documentType: QaProcedureDocumentType;
  title: string;
  summary: string;
  scopeType: QaProcedureScopeType;
  scopeSummary: string;
  versionNo: number;
  effectiveDate?: string | null;
  status: QaProcedureStatus;
  retiredAt?: string | null;
  isSiteRequired: boolean;
  referenceTargets: QaProcedureReferenceTarget[];
  externalDocUrl: string;
  fileAssetId?: string | null;
  fileName: string;
  fileUrl?: string;
  authorName: string;
  isLatestVersion?: boolean;
  createdAt: string;
  updatedAt: string;
  actions?: string;
};

type ProcedureResponse = {
  ok: boolean;
  data: ProcedureItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type UploadResponse = {
  ok: boolean;
  data?: {
    fileAssetId: string;
    originalName: string;
    storagePath: string;
  };
  error?: string;
};

type ProcedureForm = {
  documentKey: string;
  categoryCode: string;
  documentType: QaProcedureDocumentType;
  title: string;
  summary: string;
  scopeType: QaProcedureScopeType;
  scopeSummary: string;
  versionNo: string;
  effectiveDate: string;
  status: QaProcedureStatus;
  retiredAt: string;
  isSiteRequired: boolean;
  referenceTargets: QaProcedureReferenceTarget[];
  externalDocUrl: string;
  fileAssetId: string;
  fileName: string;
  fileUrl: string;
};

type DeleteTarget = Pick<ProcedureItem, "_id" | "title" | "versionNo" | "documentType">;
type ProcedureSort = "document_key" | "updated_desc" | "effective_desc" | "effective_asc";

const PROCEDURE_SORT_OPTIONS: Array<{ value: ProcedureSort; label: string }> = [
  { value: "document_key", label: "문서키순" },
  { value: "updated_desc", label: "최근 수정순" },
  { value: "effective_desc", label: "시행일 최신순" },
  { value: "effective_asc", label: "시행일 오래된순" },
];

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 10);
}

function createEmptyForm(): ProcedureForm {
  return {
    documentKey: "",
    categoryCode: "SOP",
    documentType: "procedure",
    title: "",
    summary: "",
    scopeType: "common",
    scopeSummary: "",
    versionNo: "1",
    effectiveDate: "",
    status: "active",
    retiredAt: "",
    isSiteRequired: true,
    referenceTargets: ["qap"],
    externalDocUrl: "",
    fileAssetId: "",
    fileName: "",
    fileUrl: "",
  };
}

function StatusPill({ status }: { status: QaProcedureStatus }) {
  const toneClass =
    status === "retired"
      ? "border-slate-200 bg-slate-100 text-slate-600"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_PROCEDURE_STATUS_LABELS[status]}
    </span>
  );
}

export default function QaProceduresPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<ProcedureItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<"all" | QaProcedureDocumentType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | QaProcedureStatus>("all");
  const [versionView, setVersionView] = useState<"all" | "latest">("latest");
  const [referenceTargetFilter, setReferenceTargetFilter] = useState<"all" | QaProcedureReferenceTarget>("all");
  const [siteRequiredFilter, setSiteRequiredFilter] = useState<"all" | "yes" | "no">("all");
  const [sortBy, setSortBy] = useState<ProcedureSort>("document_key");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProcedureForm>(() => createEmptyForm());
  const [selectedItem, setSelectedItem] = useState<ProcedureItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          categoryCode: categoryFilter,
          documentType: documentTypeFilter,
          status: statusFilter,
          versionView,
          referenceTarget: referenceTargetFilter,
          siteRequired: siteRequiredFilter,
          sort: sortBy,
        });

        const response = await fetch(`/api/qa/procedures?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as ProcedureResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "표준 절차·템플릿 조회 실패");
        }

        setItems(Array.isArray(result.data) ? result.data : []);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "표준 절차·템플릿 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [categoryFilter, documentTypeFilter, keyword, referenceTargetFilter, siteRequiredFilter, sortBy, statusFilter, versionView],
  );

  useEffect(() => {
    void loadItems(1);
  }, [loadItems]);

  function resetFilters() {
    setKeyword("");
    setCategoryFilter("ALL");
    setDocumentTypeFilter("all");
    setStatusFilter("all");
    setVersionView("latest");
    setReferenceTargetFilter("all");
    setSiteRequiredFilter("all");
    setSortBy("document_key");
    void loadItems(1);
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
  }

  function updateFormField<K extends keyof ProcedureForm>(field: K, value: ProcedureForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleToggleReferenceTarget(target: QaProcedureReferenceTarget) {
    setForm((current) => ({
      ...current,
      referenceTargets: current.referenceTargets.includes(target)
        ? current.referenceTargets.filter((item) => item !== target)
        : [...current.referenceTargets, target],
    }));
  }

  const handleEdit = useCallback((item: ProcedureItem) => {
    setEditingId(item._id);
    setForm({
      documentKey: item.documentKey,
      categoryCode: item.categoryCode,
      documentType: item.documentType,
      title: item.title,
      summary: item.summary,
      scopeType: item.scopeType,
      scopeSummary: item.scopeSummary,
      versionNo: String(item.versionNo),
      effectiveDate: formatDate(item.effectiveDate) === "-" ? "" : formatDate(item.effectiveDate),
      status: item.status,
      retiredAt: formatDate(item.retiredAt) === "-" ? "" : formatDate(item.retiredAt),
      isSiteRequired: item.isSiteRequired,
      referenceTargets: item.referenceTargets,
      externalDocUrl: item.externalDocUrl,
      fileAssetId: item.fileAssetId ? String(item.fileAssetId) : "",
      fileName: item.fileName,
      fileUrl: item.fileUrl ?? "",
    });
    setSelectedItem(null);
    setMessage(null);
    setError(null);
  }, []);

  const handleRequestDelete = useCallback((item: ProcedureItem) => {
    if (!canManage) {
      return;
    }
    setDeleteTarget({
      _id: item._id,
      title: item.title,
      versionNo: item.versionNo,
      documentType: item.documentType,
    });
    setMessage(null);
    setError(null);
  }, [canManage]);

  async function handleFileUpload(files: File[]) {
    const first = files[0];
    if (!first) {
      updateFormField("fileAssetId", "");
      updateFormField("fileName", "");
      updateFormField("fileUrl", "");
      return;
    }

    setIsUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", first);
      formData.append("module", "qa-procedures");
      if (user.userId) {
        formData.append("uploadedBy", user.userId);
      }

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as UploadResponse;
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "파일 업로드 실패");
      }

      updateFormField("fileAssetId", result.data.fileAssetId);
      updateFormField("fileName", result.data.originalName);
      updateFormField("fileUrl", buildUploadUrl(result.data.storagePath));
      setMessage("파일이 업로드되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "파일 업로드 실패");
    } finally {
      setIsUploading(false);
    }
  }

  function clearAttachment() {
    updateFormField("fileAssetId", "");
    updateFormField("fileName", "");
    updateFormField("fileUrl", "");
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
      const endpoint = editingId ? `/api/qa/procedures/${editingId}` : "/api/qa/procedures";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentKey: form.documentKey,
          categoryCode: form.categoryCode,
          documentType: form.documentType,
          title: form.title,
          summary: form.summary,
          scopeType: form.scopeType,
          scopeSummary: form.scopeSummary,
          versionNo: Number(form.versionNo),
          effectiveDate: form.effectiveDate,
          status: form.status,
          retiredAt: form.retiredAt,
          isSiteRequired: form.isSiteRequired,
          referenceTargets: form.referenceTargets,
          externalDocUrl: form.externalDocUrl,
          fileAssetId: form.fileAssetId,
          fileName: form.fileName,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "표준 절차·템플릿 저장 실패");
      }

      setMessage(editingId ? "표준 절차·템플릿이 수정되었습니다." : "표준 절차·템플릿이 등록되었습니다.");
      resetForm();
      await loadItems(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "표준 절차·템플릿 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!canManage || !deleteTarget) {
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/qa/procedures/${deleteTarget._id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "표준 절차·템플릿 삭제 실패");
      }
      if (editingId === deleteTarget._id) {
        resetForm();
      }
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
      setDeleteTarget(null);
      setMessage("표준 절차·템플릿이 삭제되었습니다.");
      await loadItems(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "표준 절차·템플릿 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo<DataTableColumn<ProcedureItem>[]>(
    () => [
      {
        key: "documentKey",
        header: "문서키/버전",
        className: "w-32 align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.documentKey}</p>
            <p className="text-xs text-foreground-muted">Ver.{row.versionNo}</p>
            {row.isLatestVersion ? (
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                최신본
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: "title",
        header: "절차서/템플릿",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.title}</p>
            <p className="text-xs text-foreground-muted">
              {QA_PROCEDURE_DOCUMENT_TYPE_LABELS[row.documentType]} · {row.categoryCode}
            </p>
            {row.summary ? <p className="text-xs text-foreground-muted">{row.summary}</p> : null}
            {row.fileUrl || row.externalDocUrl ? (
              <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                {row.fileUrl ? (
                  <a
                    href={row.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-700 hover:bg-sky-100"
                  >
                    첨부 열기
                  </a>
                ) : null}
                {row.externalDocUrl ? (
                  <a
                    href={row.externalDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-200"
                  >
                    외부 링크
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: "scopeSummary",
        header: "적용범위/연계",
        className: "min-w-[220px] align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">
              {QA_PROCEDURE_SCOPE_TYPE_LABELS[row.scopeType]}
            </p>
            <p className="text-xs text-foreground-muted">{row.scopeSummary}</p>
            <p className="text-xs text-foreground-muted">
              {row.isSiteRequired ? "현장 필수 적용" : "선택 적용"} ·{" "}
              {row.referenceTargets.length
                ? row.referenceTargets.map((item) => QA_PROCEDURE_REFERENCE_TARGET_LABELS[item]).join(", ")
                : "참조 연결 없음"}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        header: "상태",
        className: "w-24",
        render: (value) => <StatusPill status={value as QaProcedureStatus} />,
      },
      {
        key: "effectiveDate",
        header: "시행/폐기",
        className: "w-28",
        render: (_value, row) => (
          <div className="space-y-1 text-xs">
            <p className="text-foreground">시행 {formatDate(row.effectiveDate)}</p>
            <p className="text-foreground-muted">폐기 {formatDate(row.retiredAt)}</p>
          </div>
        ),
      },
      {
        key: "actions",
        header: "작업",
        className: "w-32",
        render: (_value, row) =>
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleEdit(row);
                }}
                className="rounded-md border border-border bg-background-soft px-3 py-1 text-xs font-medium text-foreground hover:bg-background-card"
              >
                수정
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRequestDelete(row);
                }}
                className="rounded-md border border-danger/40 bg-danger/5 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/10"
              >
                삭제
              </button>
            </div>
          ) : (
            <span className="text-xs text-foreground-muted">조회</span>
          ),
      },
    ],
    [canManage, handleEdit, handleRequestDelete],
  );

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-muted">QA</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">표준 절차·템플릿</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          SOP와 문서 템플릿을 카테고리, 버전, 적용범위 기준으로 관리합니다.
        </p>
      </header>

      <QaFilterPanel
        description="문서유형, 상태, 버전 기준으로 표준 절차와 템플릿을 정리해 조회합니다."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadItems(1)}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              필터 초기화
            </button>
          </>
        }
        footer={
          <QaSortSelect
            compact
            value={sortBy}
            options={PROCEDURE_SORT_OPTIONS}
            onChange={(value) => setSortBy(value as ProcedureSort)}
          />
        }
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_140px_140px_140px_140px_140px]">
          <FormInput
            label="검색어"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="제목, 문서키, 요약, 적용범위"
          />
          <FormInput
            label="카테고리"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value.toUpperCase())}
            placeholder="ALL"
          />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">문서유형</span>
            <select
              value={documentTypeFilter}
              onChange={(event) => setDocumentTypeFilter(event.target.value as "all" | QaProcedureDocumentType)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_PROCEDURE_DOCUMENT_TYPE_VALUES.map((type) => (
                <option key={type} value={type}>
                  {QA_PROCEDURE_DOCUMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">상태</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | QaProcedureStatus)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_PROCEDURE_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {QA_PROCEDURE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">버전 보기</span>
            <select
              value={versionView}
              onChange={(event) => setVersionView(event.target.value as "all" | "latest")}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="latest">최신본</option>
              <option value="all">전체 버전</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">현장 적용</span>
            <select
              value={siteRequiredFilter}
              onChange={(event) => setSiteRequiredFilter(event.target.value as "all" | "yes" | "no")}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              <option value="yes">필수</option>
              <option value="no">선택</option>
            </select>
          </label>
        </div>
      </QaFilterPanel>

      <div className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">참조 포인트 필터</span>
            <select
              value={referenceTargetFilter}
              onChange={(event) =>
                setReferenceTargetFilter(event.target.value as "all" | QaProcedureReferenceTarget)
              }
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_PROCEDURE_REFERENCE_TARGET_VALUES.map((target) => (
                <option key={target} value={target}>
                  {QA_PROCEDURE_REFERENCE_TARGET_LABELS[target]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {canManage ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {editingId ? "표준 절차·템플릿 수정" : "표준 절차·템플릿 등록"}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                카테고리, 버전, 적용범위, 파일/외부 문서 연결을 함께 관리합니다.
              </p>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
              >
                편집 취소
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <FormInput
              label="문서키"
              value={form.documentKey}
              onChange={(event) => updateFormField("documentKey", event.target.value.toUpperCase())}
              placeholder="예: CONC-SOP"
              required
            />
            <FormInput
              label="카테고리"
              value={form.categoryCode}
              onChange={(event) => updateFormField("categoryCode", event.target.value.toUpperCase())}
              placeholder="예: SOP"
              required
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">문서유형</span>
              <select
                value={form.documentType}
                onChange={(event) =>
                  updateFormField("documentType", event.target.value as QaProcedureDocumentType)
                }
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_PROCEDURE_DOCUMENT_TYPE_VALUES.map((type) => (
                  <option key={type} value={type}>
                    {QA_PROCEDURE_DOCUMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <FormInput
              label="버전"
              value={form.versionNo}
              onChange={(event) =>
                updateFormField("versionNo", event.target.value.replace(/[^0-9]/g, "").slice(0, 2))
              }
              required
              inputMode="numeric"
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">상태</span>
              <select
                value={form.status}
                onChange={(event) => updateFormField("status", event.target.value as QaProcedureStatus)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_PROCEDURE_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {QA_PROCEDURE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FormInput
              label="제목"
              value={form.title}
              onChange={(event) => updateFormField("title", event.target.value)}
              required
            />
            <FormInput
              label="시행일"
              type="date"
              value={form.effectiveDate}
              onChange={(event) => updateFormField("effectiveDate", event.target.value)}
            />
            <FormInput
              label="폐기일"
              type="date"
              value={form.retiredAt}
              onChange={(event) => updateFormField("retiredAt", event.target.value)}
            />
          </div>

          <FormInput
            label="요약"
            value={form.summary}
            onChange={(event) => updateFormField("summary", event.target.value)}
            placeholder="문서 목적과 변경 요약"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">적용범위 유형</span>
              <select
                value={form.scopeType}
                onChange={(event) => updateFormField("scopeType", event.target.value as QaProcedureScopeType)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_PROCEDURE_SCOPE_TYPE_VALUES.map((type) => (
                  <option key={type} value={type}>
                    {QA_PROCEDURE_SCOPE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">현장 적용 여부</span>
              <select
                value={form.isSiteRequired ? "yes" : "no"}
                onChange={(event) => updateFormField("isSiteRequired", event.target.value === "yes")}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="yes">필수 적용</option>
                <option value="no">선택 적용</option>
              </select>
            </label>
          </div>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">적용범위 설명</span>
            <textarea
              value={form.scopeSummary}
              onChange={(event) => updateFormField("scopeSummary", event.target.value)}
              rows={3}
              required
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="적용 대상 공정, 현장, 사용 시점을 설명하세요."
            />
          </label>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">참조 포인트</p>
            <div className="flex flex-wrap gap-3">
              {QA_PROCEDURE_REFERENCE_TARGET_VALUES.map((target) => (
                <label key={target} className="inline-flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={form.referenceTargets.includes(target)}
                    onChange={() => handleToggleReferenceTarget(target)}
                    className="h-4 w-4 rounded border border-border"
                  />
                  <span>{QA_PROCEDURE_REFERENCE_TARGET_LABELS[target]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-border bg-background-soft p-4">
              <FileUpload
                label="첨부파일"
                multiple={false}
                onFilesChange={(files) => void handleFileUpload(files)}
              />
              <p className="text-xs text-foreground-muted">
                {isUploading
                  ? "업로드 중..."
                  : form.fileName
                    ? `첨부: ${form.fileName} (${form.fileAssetId})`
                    : "첨부파일이 없으면 외부 문서 URL을 입력하세요."}
              </p>
              {form.fileName ? (
                <div className="flex flex-wrap gap-2">
                  {form.fileUrl ? (
                    <a
                      href={form.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                    >
                      첨부 열기
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearAttachment}
                    className="rounded-md border border-border bg-background-card px-3 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
                  >
                    첨부 제거
                  </button>
                </div>
              ) : null}
            </div>
            <FormInput
              label="외부 문서 URL"
              value={form.externalDocUrl}
              onChange={(event) => updateFormField("externalDocUrl", event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
            >
              {editingId ? "수정 저장" : "등록"}
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <div className="rounded-xl border border-border bg-background-card p-5 text-sm text-foreground-muted shadow-[var(--shadow-soft)]">
          등록/수정/삭제는 `manager` 이상 권한이 필요합니다.
        </div>
      )}

      <QaFeedbackBanners message={message} error={error} />

      <DataTable<ProcedureItem>
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "표준 절차·템플릿을 불러오는 중입니다." : "등록된 표준 절차·템플릿이 없습니다."}
        onRowClick={(row) => setSelectedItem(row)}
        getRowAriaLabel={(row) => `${row.title} 상세 보기`}
      />

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadItems(nextPage)} />
      ) : null}

      <Modal
        open={selectedItem !== null}
        title="표준 절차·템플릿 상세"
        onClose={() => setSelectedItem(null)}
      >
        {selectedItem ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background-soft p-3 text-sm">
              <div>
                <p className="text-xs font-medium text-foreground-muted">문서키</p>
                <p className="mt-1 text-foreground">{selectedItem.documentKey}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">버전</p>
                <p className="mt-1 text-foreground">Ver.{selectedItem.versionNo}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">문서유형</p>
                <p className="mt-1 text-foreground">
                  {QA_PROCEDURE_DOCUMENT_TYPE_LABELS[selectedItem.documentType]}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">상태</p>
                <div className="mt-1">
                  <StatusPill status={selectedItem.status} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">제목</p>
              <p className="mt-1 font-medium text-foreground">{selectedItem.title}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">요약</p>
              <p className="mt-1 text-sm text-foreground">{selectedItem.summary || "-"}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">적용범위</p>
              <p className="mt-1 text-sm text-foreground">
                {QA_PROCEDURE_SCOPE_TYPE_LABELS[selectedItem.scopeType]} · {selectedItem.scopeSummary}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-foreground-muted">현장 적용</p>
                <p className="mt-1 text-sm text-foreground">
                  {selectedItem.isSiteRequired ? "필수 적용" : "선택 적용"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">참조 포인트</p>
                <p className="mt-1 text-sm text-foreground">
                  {selectedItem.referenceTargets.length
                    ? selectedItem.referenceTargets
                        .map((item) => QA_PROCEDURE_REFERENCE_TARGET_LABELS[item])
                        .join(", ")
                    : "-"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-foreground-muted">시행일</p>
                <p className="mt-1 text-sm text-foreground">{formatDate(selectedItem.effectiveDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">폐기일</p>
                <p className="mt-1 text-sm text-foreground">{formatDate(selectedItem.retiredAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-foreground-muted">첨부파일</p>
                {selectedItem.fileName ? (
                  <div className="mt-1 space-y-2 text-sm text-foreground">
                    <p>{selectedItem.fileName}</p>
                    {selectedItem.fileUrl ? (
                      <a
                        href={selectedItem.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
                      >
                        첨부 다운로드
                      </a>
                    ) : (
                      <p className="text-xs text-foreground-muted">다운로드 경로를 찾을 수 없습니다.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-foreground">-</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">외부 문서 URL</p>
                {selectedItem.externalDocUrl ? (
                  <a
                    href={selectedItem.externalDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-sm text-sky-700 underline"
                  >
                    {selectedItem.externalDocUrl}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-foreground">-</p>
                )}
              </div>
            </div>

            {canManage ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleEdit(selectedItem)}
                  className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                >
                  수정으로 열기
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="표준 절차·템플릿 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">아래 항목을 삭제하시겠습니까?</p>
            <div className="rounded-lg border border-border bg-background-soft p-3 text-sm text-foreground">
              <p className="font-medium">{deleteTarget.title}</p>
              <p className="mt-1 text-foreground-muted">
                {QA_PROCEDURE_DOCUMENT_TYPE_LABELS[deleteTarget.documentType]} · Ver.{deleteTarget.versionNo}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId !== null}
                className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deletingId !== null}
                className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/15 disabled:opacity-60"
              >
                삭제
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
