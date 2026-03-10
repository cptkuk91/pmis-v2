"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, FileUpload, FormInput, Pagination, StatusBadge } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type ReportType = "supervision" | "daily" | "weekly";
type Status = "draft" | "in_review" | "approved" | "rejected" | "completed";

type ReportAttachment = {
  fileAssetId: string;
  fileName: string;
  sortOrder: number;
};

type ReportRow = {
  _id: string;
  reportType: ReportType;
  title: string;
  reportDate: string;
  authorName: string;
  content: string;
  progressRate: number;
  attachments?: ReportAttachment[];
  status: Status;
  actions?: string;
};

type ReportFormState = {
  title: string;
  reportType: ReportType;
  reportDate: string;
  progressRate: number;
  content: string;
  attachments: ReportAttachment[];
  status: Status;
};

type DeleteTarget = {
  _id: string;
  title: string;
};

type ReportResponse = {
  ok: boolean;
  data: ReportRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type MutationResponse = {
  ok: boolean;
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

const reportTypeLabel: Record<ReportType, string> = {
  supervision: "감리",
  daily: "일보",
  weekly: "주간",
};

const statusOptions: Array<{ value: Status; label: string }> = [
  { value: "draft", label: "임시저장" },
  { value: "in_review", label: "검토중" },
  { value: "approved", label: "승인" },
  { value: "rejected", label: "반려" },
  { value: "completed", label: "완료" },
];

function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekOfMonth(value: string): number {
  const [year, month, day] = value.split("-").map((item) => Number(item));
  if (!year || !month || !day) {
    return 1;
  }

  const date = new Date(year, month - 1, day);
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

function buildDefaultReportTitle(reportDate: string, reportType: ReportType): string {
  if (reportType !== "weekly") {
    return "";
  }

  const [, month] = reportDate.split("-");
  const monthLabel = month ? `${Number(month)}월` : "";
  const weekOfMonth = getWeekOfMonth(reportDate);
  return `${monthLabel} ${weekOfMonth}주차 공정 주간보고`.trim();
}

function createDefaultReportForm(): ReportFormState {
  const reportDate = getTodayDateInputValue();
  return {
    title: buildDefaultReportTitle(reportDate, "weekly"),
    reportType: "weekly",
    reportDate,
    progressRate: 0,
    content: "",
    attachments: [],
    status: "draft",
  };
}

type ReportFormFieldsProps = {
  form: ReportFormState;
  isCustomTitle: boolean;
  isUploading: boolean;
  onChange: (patch: Partial<ReportFormState>) => void;
  onTitleChange: (value: string) => void;
  onFilesChange: (files: File[]) => void;
  onRemoveAttachment: (fileAssetId: string) => void;
};

function ReportFormFields({
  form,
  isCustomTitle,
  isUploading,
  onChange,
  onTitleChange,
  onFilesChange,
  onRemoveAttachment,
}: ReportFormFieldsProps) {
  const defaultTitle = buildDefaultReportTitle(form.reportDate, form.reportType);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <FormInput
          label="제목"
          value={form.title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="예: 2월 4주차 공정 주간보고"
          required
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">유형</span>
          <select
            value={form.reportType}
            onChange={(event) => onChange({ reportType: event.target.value as ReportType })}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="supervision">감리</option>
            <option value="daily">일보</option>
            <option value="weekly">주간</option>
          </select>
        </label>
        <FormInput
          label="보고일"
          type="date"
          value={form.reportDate}
          onChange={(event) => onChange({ reportDate: event.target.value })}
          required
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">상태</span>
          <select
            value={form.status}
            onChange={(event) => onChange({ status: event.target.value as Status })}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
        <div className="rounded-md border border-dashed border-border bg-background-card px-3 py-2 text-xs text-foreground-muted">
          {form.reportType === "weekly"
            ? isCustomTitle
              ? `자동 제목 기본값: ${defaultTitle || "-"}`
              : `자동 제목 적용 중: ${defaultTitle || "-"}`
            : "주간 보고가 아닐 경우 제목은 직접 입력합니다."}
        </div>
        <FormInput
          label="진도율(%)"
          type="number"
          min={0}
          max={100}
          value={String(form.progressRate)}
          onChange={(event) => onChange({ progressRate: Number(event.target.value || "0") })}
        />
      </div>

      <label className="space-y-1">
        <span className="block text-sm font-medium text-foreground">내용</span>
        <textarea
          value={form.content}
          onChange={(event) => onChange({ content: event.target.value })}
          rows={4}
          className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none focus:border-border-strong focus:ring-2 focus:ring-primary/15"
          placeholder="공정 현황, 이슈, 조치 사항"
        />
      </label>

      <div className="space-y-2">
        <FileUpload label="첨부파일(사진 포함)" multiple onFilesChange={onFilesChange} />
        {form.attachments.length > 0 ? (
          <ul className="space-y-1 rounded-md border border-border bg-background-card p-3 text-xs text-foreground-muted">
            {form.attachments.map((file) => (
              <li key={file.fileAssetId} className="flex items-center justify-between gap-2">
                <span className="truncate">{file.fileName}</span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(file.fileAssetId)}
                  className="rounded border border-border px-2 py-0.5 text-xs text-foreground hover:bg-background-soft"
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {isUploading ? <p className="text-xs text-foreground-muted">첨부파일 업로드 중...</p> : null}
      </div>
    </>
  );
}

export default function ProgressReportsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canWrite = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [items, setItems] = useState<ReportRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState<"all" | ReportType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  const [form, setForm] = useState<ReportFormState>(createDefaultReportForm);
  const [isCustomTitle, setIsCustomTitle] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ReportFormState>(createDefaultReportForm);
  const [editIsCustomTitle, setEditIsCustomTitle] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<"create" | "edit" | null>(null);
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
          reportType: reportTypeFilter,
          status: statusFilter,
        });

        const response = await fetch(`/api/progress/reports?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as ReportResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "보고서 조회 실패");
        }

        setItems(result.data);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "보고서 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, reportTypeFilter, statusFilter],
  );

  useEffect(() => {
    void loadData(1);
  }, [loadData]);

  useEffect(() => {
    if (isCustomTitle) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      title: buildDefaultReportTitle(prev.reportDate, prev.reportType),
    }));
  }, [isCustomTitle, form.reportDate, form.reportType]);

  useEffect(() => {
    if (editIsCustomTitle) {
      return;
    }

    setEditForm((prev) => ({
      ...prev,
      title: buildDefaultReportTitle(prev.reportDate, prev.reportType),
    }));
  }, [editIsCustomTitle, editForm.reportDate, editForm.reportType]);

  const createUploading = uploadTarget === "create";
  const editUploading = uploadTarget === "edit";

  const handleFormChange = useCallback((patch: Partial<ReportFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleEditFormChange = useCallback((patch: Partial<ReportFormState>) => {
    setEditForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleTitleChange = useCallback(
    (value: string) => {
      const defaultTitle = buildDefaultReportTitle(form.reportDate, form.reportType);
      setIsCustomTitle(value.trim() !== "" && value !== defaultTitle);
      setForm((prev) => ({ ...prev, title: value }));
    },
    [form.reportDate, form.reportType],
  );

  const handleEditTitleChange = useCallback(
    (value: string) => {
      const defaultTitle = buildDefaultReportTitle(editForm.reportDate, editForm.reportType);
      setEditIsCustomTitle(value.trim() !== "" && value !== defaultTitle);
      setEditForm((prev) => ({ ...prev, title: value }));
    },
    [editForm.reportDate, editForm.reportType],
  );

  const removeAttachment = useCallback((target: "create" | "edit", fileAssetId: string) => {
    const updateAttachments = (attachments: ReportAttachment[]) =>
      attachments
        .filter((row) => row.fileAssetId !== fileAssetId)
        .map((row, index) => ({ ...row, sortOrder: index }));

    if (target === "edit") {
      setEditForm((prev) => ({ ...prev, attachments: updateAttachments(prev.attachments) }));
      return;
    }

    setForm((prev) => ({ ...prev, attachments: updateAttachments(prev.attachments) }));
  }, []);

  const handleUpload = useCallback(
    async (files: File[], target: "create" | "edit") => {
      if (files.length === 0) {
        return;
      }

      setUploadTarget(target);
      setError(null);
      setMessage(null);

      try {
        const uploaded = await Promise.all(
          files.map(async (file, index) => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("module", "progress-reports");
            if (user.userId) {
              formData.append("uploadedBy", user.userId);
            }

            const response = await fetch("/api/files/upload", {
              method: "POST",
              body: formData,
            });
            const result = (await response.json()) as UploadResponse;
            if (!result.ok || !result.data) {
              throw new Error(result.error ?? "첨부 업로드 실패");
            }

            return {
              fileAssetId: result.data.fileAssetId,
              fileName: result.data.originalName,
              sortOrder: index,
            };
          }),
        );

        const appendAttachments = (attachments: ReportAttachment[]) =>
          [...attachments, ...uploaded].map((row, index) => ({
            ...row,
            sortOrder: index,
          }));

        if (target === "edit") {
          setEditForm((prev) => ({
            ...prev,
            attachments: appendAttachments(prev.attachments),
          }));
        } else {
          setForm((prev) => ({
            ...prev,
            attachments: appendAttachments(prev.attachments),
          }));
        }

        setMessage(`${uploaded.length}개 첨부파일이 업로드되었습니다.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "첨부 업로드 실패");
      } finally {
        setUploadTarget(null);
      }
    },
    [user.userId],
  );

  const handleOpenEditModal = useCallback((row: ReportRow) => {
    const reportDate = row.reportDate ? String(row.reportDate).slice(0, 10) : getTodayDateInputValue();
    const currentTitle = row.title ?? "";
    const defaultTitle = buildDefaultReportTitle(reportDate, row.reportType);

    setEditForm({
      title: currentTitle,
      reportType: row.reportType,
      reportDate,
      progressRate: Number(row.progressRate ?? 0),
      content: row.content ?? "",
      attachments: Array.isArray(row.attachments)
        ? row.attachments.map((item, index) => ({
            fileAssetId: item.fileAssetId,
            fileName: item.fileName,
            sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
          }))
        : [],
      status: row.status,
    });
    setEditIsCustomTitle(currentTitle.trim() !== "" && currentTitle !== defaultTitle);
    setEditingId(row._id);
    setError(null);
    setMessage(null);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    if (isUpdating || editUploading) {
      return;
    }
    setEditingId(null);
    setEditForm(createDefaultReportForm());
    setEditIsCustomTitle(false);
  }, [editUploading, isUpdating]);

  const handleOpenDeleteModal = useCallback((row: ReportRow) => {
    setDeleteTarget({ _id: row._id, title: row.title });
    setError(null);
    setMessage(null);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    if (deletingId) {
      return;
    }
    setDeleteTarget(null);
  }, [deletingId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/progress/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = (await response.json()) as MutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "보고서 등록 실패");
      }

      setForm(createDefaultReportForm());
      setIsCustomTitle(false);
      setMessage("보고서가 등록되었습니다.");
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "보고서 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) {
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/progress/reports/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const result = (await response.json()) as MutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "보고서 수정 실패");
      }

      setEditingId(null);
      setEditForm(createDefaultReportForm());
      setEditIsCustomTitle(false);
      setMessage("보고서가 수정되었습니다.");
      await loadData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "보고서 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/progress/reports/${deleteTarget._id}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as MutationResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "보고서 삭제 실패");
      }

      setDeleteTarget(null);
      setMessage("보고서가 삭제되었습니다.");
      await loadData(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "보고서 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo<DataTableColumn<ReportRow>[]>(() => {
    const baseColumns: DataTableColumn<ReportRow>[] = [
      {
        key: "reportDate",
        header: "보고일",
        className: "w-28",
        render: (value: unknown) => new Date(String(value)).toLocaleDateString("ko-KR"),
      },
      {
        key: "reportType",
        header: "유형",
        className: "w-20",
        render: (value: unknown) => reportTypeLabel[value as ReportType],
      },
      { key: "title", header: "제목" },
      { key: "authorName", header: "작성자", className: "w-24" },
      {
        key: "progressRate",
        header: "진도율",
        className: "w-20 text-right",
        render: (value: unknown) => `${Number(value).toFixed(1)}%`,
      },
      {
        key: "attachments",
        header: "첨부",
        className: "w-20 text-right",
        render: (value: unknown) => `${Array.isArray(value) ? value.length : 0}건`,
      },
      {
        key: "status",
        header: "상태",
        className: "w-24",
        render: (value: unknown) => <StatusBadge status={value as Status} />,
      },
    ];

    if (!canWrite) {
      return baseColumns;
    }

    return [
      ...baseColumns,
      {
        key: "actions",
        header: "관리",
        className: "w-32",
        render: (_value, row) => (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleOpenEditModal(row)}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => handleOpenDeleteModal(row)}
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        ),
      },
    ];
  }, [canWrite, handleOpenDeleteModal, handleOpenEditModal]);

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header>
        <h1 className="text-xl font-semibold text-foreground">현장 리포트 (감리/일보/주간)</h1>
        <p className="mt-1 text-sm text-foreground-muted">현장 보고서를 등록하고 상태별로 조회합니다.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]">
        <FormInput
          label="검색어"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="제목/내용/작성자"
        />
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">유형</span>
          <select
            value={reportTypeFilter}
            onChange={(event) => setReportTypeFilter(event.target.value as "all" | ReportType)}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            <option value="supervision">감리</option>
            <option value="daily">일보</option>
            <option value="weekly">주간</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-sm font-medium text-foreground">상태</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | Status)}
            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
          >
            <option value="all">전체</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border bg-background-soft p-4">
          <ReportFormFields
            form={form}
            isCustomTitle={isCustomTitle}
            isUploading={createUploading}
            onChange={handleFormChange}
            onTitleChange={handleTitleChange}
            onFilesChange={(files) => void handleUpload(files, "create")}
            onRemoveAttachment={(fileAssetId) => removeAttachment("create", fileAssetId)}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || createUploading}
              className="rounded-md bg-[#ecebe8] px-4 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "등록"}
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <p className="text-sm text-foreground-muted">보고서 등록은 `manager` 이상 권한이 필요합니다.</p>
      )}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <DataTable<ReportRow>
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 보고서가 없습니다."}
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadData(nextPage)} />

      <Modal open={Boolean(editingId)} title="공정 보고서 수정" onClose={handleCloseEditModal}>
        <form className="space-y-4" onSubmit={handleUpdate}>
          <ReportFormFields
            form={editForm}
            isCustomTitle={editIsCustomTitle}
            isUploading={editUploading}
            onChange={handleEditFormChange}
            onTitleChange={handleEditTitleChange}
            onFilesChange={(files) => void handleUpload(files, "edit")}
            onRemoveAttachment={(fileAssetId) => removeAttachment("edit", fileAssetId)}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseEditModal}
              disabled={isUpdating || editUploading}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isUpdating || editUploading}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
            >
              {isUpdating ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="공정 보고서 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            <span className="font-medium">{deleteTarget?.title ?? "-"}</span>
            {" "}
            보고서를 삭제하시겠습니까?
          </p>
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
              className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-60"
            >
              {deletingId ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
