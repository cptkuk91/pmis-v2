"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { QcFeedbackBanners } from "@/components/qc/feedback-banners";
import { QcFilterPanel } from "@/components/qc/filter-panel";
import { QcSortSelect } from "@/components/qc/sort-select";
import { DataTable } from "@/components/ui/data-table";
import { FileUpload } from "@/components/ui/file-upload";
import { FormInput } from "@/components/ui/form-input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import type { DataTableColumn } from "@/components/ui/data-table";
import { formatSiteMemberSummary, useSiteMembers, type SiteMemberOption } from "@/hooks/use-site-members";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import { buildUploadUrl } from "@/lib/file-asset-url";
import { QC_ATTACHMENT_CATEGORY_LABELS, type QcAttachmentCategory } from "@/lib/qc-core";
import {
  QC_NONCONFORMANCE_ATTACHMENT_CATEGORY_OPTIONS,
  QC_NONCONFORMANCE_HISTORY_ACTION_LABELS,
  QC_NONCONFORMANCE_OCCURRENCE_TYPE_LABELS,
  QC_NONCONFORMANCE_OCCURRENCE_TYPE_VALUES,
  QC_NONCONFORMANCE_REMINDER_DAYS,
  QC_NONCONFORMANCE_SEVERITY_LABELS,
  QC_NONCONFORMANCE_SEVERITY_VALUES,
  QC_NONCONFORMANCE_SORT_LABELS,
  QC_NONCONFORMANCE_SORT_VALUES,
  QC_NONCONFORMANCE_SOURCE_TYPE_LABELS,
  QC_NONCONFORMANCE_SOURCE_TYPE_VALUES,
  QC_NONCONFORMANCE_STATUS_LABELS,
  QC_NONCONFORMANCE_STATUS_TRANSITIONS,
  QC_NONCONFORMANCE_STATUS_VALUES,
  QC_NONCONFORMANCE_VERIFICATION_RESULT_LABELS,
  QC_NONCONFORMANCE_VERIFICATION_RESULT_VALUES,
  isQcNonconformanceDueSoon,
  isQcNonconformanceOverdue,
  type QcNonconformanceAttachment,
  type QcNonconformanceHistoryAction,
  type QcNonconformanceHistoryEntry,
  type QcNonconformanceOccurrenceType,
  type QcNonconformanceSeverity,
  type QcNonconformanceSort,
  type QcNonconformanceSourceType,
  type QcNonconformanceStatus,
  type QcNonconformanceVerificationResult,
} from "@/lib/qc-nonconformance";

type MaterialInspectionOption = {
  _id: string;
  label: string;
  materialName: string;
  specification: string;
  inspectionDate: string;
  result: string;
  ncrStatus: string;
  ncrReference: string;
};

type ProcessInspectionOption = {
  _id: string;
  label: string;
  inspectionTitle: string;
  location: string;
  plannedInspectionDate: string;
  result: string;
  status: string;
  issueStatus: string;
};

type TestReportOption = {
  _id: string;
  label: string;
  sampleName: string;
  certificateNo: string;
  testDate: string;
  result: string;
  ncrStatus: string;
  ncrReference: string;
};

type NonconformanceRow = {
  _id: string;
  ncrNo: string;
  occurrenceType: QcNonconformanceOccurrenceType;
  sourceType: QcNonconformanceSourceType;
  severity: QcNonconformanceSeverity;
  severityRank: number;
  title: string;
  description: string;
  occurrenceDate: string;
  location: string;
  workType: string;
  sourceSummary: string;
  linkedMaterialInspectionId: string;
  linkedMaterialInspectionTitle: string;
  linkedProcessInspectionId: string;
  linkedProcessInspectionTitle: string;
  linkedTestReportId: string;
  linkedTestReportTitle: string;
  reporterName: string;
  assigneeName: string;
  assigneeMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  dueDate: string;
  status: QcNonconformanceStatus;
  rootCauseSummary: string;
  containmentAction: string;
  correctiveActionPlan: string;
  preventiveAction: string;
  actionTaken: string;
  verificationResult: QcNonconformanceVerificationResult;
  verificationNote: string;
  verifiedAt?: string | null;
  closedAt?: string | null;
  attachments: QcNonconformanceAttachment[];
  history: QcNonconformanceHistoryEntry[];
  createdAt?: string | null;
  updatedAt?: string | null;
  actions?: string;
};

type NonconformanceSummary = {
  activeCount: number;
  verificationCount: number;
  overdueCount: number;
  criticalCount: number;
};

type NonconformanceForm = {
  occurrenceType: QcNonconformanceOccurrenceType;
  sourceType: QcNonconformanceSourceType;
  severity: QcNonconformanceSeverity;
  title: string;
  description: string;
  occurrenceDate: string;
  location: string;
  workType: string;
  sourceSummary: string;
  linkedMaterialInspectionId: string;
  linkedProcessInspectionId: string;
  linkedTestReportId: string;
  assigneeName: string;
  assigneeMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  dueDate: string;
  status: QcNonconformanceStatus;
  rootCauseSummary: string;
  containmentAction: string;
  correctiveActionPlan: string;
  preventiveAction: string;
  actionTaken: string;
  verificationResult: QcNonconformanceVerificationResult;
  verificationNote: string;
  verifiedAt: string;
  attachments: QcNonconformanceAttachment[];
  historyNote: string;
};

type NonconformanceListResponse = {
  ok: boolean;
  data: NonconformanceRow[];
  meta?: {
    page: number;
    totalPages: number;
    summary?: NonconformanceSummary;
  };
  error?: string;
};

type NonconformanceDetailResponse = {
  ok: boolean;
  data?: NonconformanceRow;
  error?: string;
};

type NonconformanceOptionsResponse = {
  ok: boolean;
  data?: {
    materialInspectionOptions?: MaterialInspectionOption[];
    processInspectionOptions?: ProcessInspectionOption[];
    testReportOptions?: TestReportOption[];
  };
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

type DeleteTarget = Pick<NonconformanceRow, "_id" | "ncrNo" | "title" | "severity" | "dueDate">;
type MemberPickerTarget = "assignee" | "verifier" | null;

const SITE_ID_KEY = "pmis:siteId";
const SORT_OPTIONS = QC_NONCONFORMANCE_SORT_VALUES.map((value) => ({
  value,
  label: QC_NONCONFORMANCE_SORT_LABELS[value],
}));

function readSiteId() {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem(SITE_ID_KEY) ?? "";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 10);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatDate(value);
  }
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createEmptyForm(): NonconformanceForm {
  const today = new Date();
  const dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
    .toISOString()
    .slice(0, 10);

  return {
    occurrenceType: "other",
    sourceType: "manual",
    severity: "medium",
    title: "",
    description: "",
    occurrenceDate: new Date().toISOString().slice(0, 10),
    location: "",
    workType: "",
    sourceSummary: "",
    linkedMaterialInspectionId: "",
    linkedProcessInspectionId: "",
    linkedTestReportId: "",
    assigneeName: "",
    assigneeMemberId: "",
    verifierName: "",
    verifierMemberId: "",
    dueDate,
    status: "open",
    rootCauseSummary: "",
    containmentAction: "",
    correctiveActionPlan: "",
    preventiveAction: "",
    actionTaken: "",
    verificationResult: "pending",
    verificationNote: "",
    verifiedAt: "",
    attachments: [],
    historyNote: "",
  };
}

function mapDetailToForm(item: NonconformanceRow): NonconformanceForm {
  return {
    occurrenceType: item.occurrenceType ?? "other",
    sourceType: item.sourceType ?? "manual",
    severity: item.severity ?? "medium",
    title: item.title ?? "",
    description: item.description ?? "",
    occurrenceDate: formatDate(item.occurrenceDate),
    location: item.location ?? "",
    workType: item.workType ?? "",
    sourceSummary: item.sourceSummary ?? "",
    linkedMaterialInspectionId: item.linkedMaterialInspectionId ?? "",
    linkedProcessInspectionId: item.linkedProcessInspectionId ?? "",
    linkedTestReportId: item.linkedTestReportId ?? "",
    assigneeName: item.assigneeName ?? "",
    assigneeMemberId: item.assigneeMemberId ?? "",
    verifierName: item.verifierName ?? "",
    verifierMemberId: item.verifierMemberId ?? "",
    dueDate: formatDate(item.dueDate),
    status: item.status ?? "open",
    rootCauseSummary: item.rootCauseSummary ?? "",
    containmentAction: item.containmentAction ?? "",
    correctiveActionPlan: item.correctiveActionPlan ?? "",
    preventiveAction: item.preventiveAction ?? "",
    actionTaken: item.actionTaken ?? "",
    verificationResult: item.verificationResult ?? "pending",
    verificationNote: item.verificationNote ?? "",
    verifiedAt: formatDate(item.verifiedAt),
    attachments:
      item.attachments?.map((attachment, index) => ({
        fileAssetId: attachment.fileAssetId,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        category: attachment.category,
        sortOrder: Number(attachment.sortOrder ?? index),
      })) ?? [],
    historyNote: "",
  };
}

function findMemberById(options: SiteMemberOption[], memberId: string) {
  return options.find((option) => option._id === memberId) ?? null;
}

function resolveSourceReferenceLabel(item: {
  sourceType: QcNonconformanceSourceType;
  linkedMaterialInspectionTitle: string;
  linkedProcessInspectionTitle: string;
  linkedTestReportTitle: string;
  sourceSummary: string;
}) {
  if (item.sourceType === "material_inspection") {
    return item.linkedMaterialInspectionTitle || item.sourceSummary || "-";
  }
  if (item.sourceType === "process_inspection") {
    return item.linkedProcessInspectionTitle || item.sourceSummary || "-";
  }
  if (item.sourceType === "test_report") {
    return item.linkedTestReportTitle || item.sourceSummary || "-";
  }
  return item.sourceSummary || "-";
}

function renderSeverityPill(severity: QcNonconformanceSeverity) {
  const toneClass =
    severity === "critical"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : severity === "high"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : severity === "medium"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_NONCONFORMANCE_SEVERITY_LABELS[severity]}
    </span>
  );
}

function renderStatusPill(status: QcNonconformanceStatus) {
  const toneClass =
    status === "closed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "verification"
        ? "border-violet-200 bg-violet-50 text-violet-700"
        : status === "action_in_progress"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : status === "analysis"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_NONCONFORMANCE_STATUS_LABELS[status]}
    </span>
  );
}

function renderVerificationPill(result: QcNonconformanceVerificationResult) {
  const toneClass =
    result === "pass"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : result === "fail"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_NONCONFORMANCE_VERIFICATION_RESULT_LABELS[result]}
    </span>
  );
}

export default function QcNonconformancePage() {
  const { user } = useCurrentUser();
  const canManage = hasMinRole(user.role, "manager");
  const {
    memberOptions,
    filteredMembers,
    memberQuery,
    setMemberQuery,
    isMemberLoading,
    memberError,
  } = useSiteMembers(canManage);

  const [items, setItems] = useState<NonconformanceRow[]>([]);
  const [summary, setSummary] = useState<NonconformanceSummary>({
    activeCount: 0,
    verificationCount: 0,
    overdueCount: 0,
    criticalCount: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const [statusFilter, setStatusFilter] = useState<"all" | QcNonconformanceStatus>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | QcNonconformanceSeverity>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | QcNonconformanceSourceType>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<QcNonconformanceSort>("due_asc");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NonconformanceForm>(() => createEmptyForm());
  const [selectedItem, setSelectedItem] = useState<NonconformanceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [memberPickerTarget, setMemberPickerTarget] = useState<MemberPickerTarget>(null);
  const [materialOptions, setMaterialOptions] = useState<MaterialInspectionOption[]>([]);
  const [processOptions, setProcessOptions] = useState<ProcessInspectionOption[]>([]);
  const [testReportOptions, setTestReportOptions] = useState<TestReportOption[]>([]);
  const [uploadCategory, setUploadCategory] = useState<QcAttachmentCategory>("report");
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedMaterial = materialOptions.find((option) => option._id === form.linkedMaterialInspectionId) ?? null;
  const selectedProcess = processOptions.find((option) => option._id === form.linkedProcessInspectionId) ?? null;
  const selectedTestReport = testReportOptions.find((option) => option._id === form.linkedTestReportId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      const siteId = readSiteId();
      if (!siteId) {
        if (!cancelled) {
          setItems([]);
          setSummary({ activeCount: 0, verificationCount: 0, overdueCount: 0, criticalCount: 0 });
          setTotalPages(1);
          setError("현장을 먼저 선택해 주세요.");
        }
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          siteId,
          page: String(page),
          limit: "10",
          q: deferredKeyword,
          sort: sortBy,
        });
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (severityFilter !== "all") {
          params.set("severity", severityFilter);
        }
        if (sourceFilter !== "all") {
          params.set("sourceType", sourceFilter);
        }
        if (overdueOnly) {
          params.set("overdueOnly", "true");
        }

        const response = await fetch(`/api/qc/nonconformance?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as NonconformanceListResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "NCR 목록 조회 실패");
        }

        if (!cancelled) {
          setItems(Array.isArray(result.data) ? result.data : []);
          setSummary(result.meta?.summary ?? { activeCount: 0, verificationCount: 0, overdueCount: 0, criticalCount: 0 });
          setPage(result.meta?.page ?? page);
          setTotalPages(result.meta?.totalPages ?? 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "NCR 목록 조회 실패");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadItems();
    return () => {
      cancelled = true;
    };
  }, [page, deferredKeyword, sortBy, statusFilter, severityFilter, sourceFilter, overdueOnly]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const siteId = readSiteId();
      if (!siteId) {
        if (!cancelled) {
          setMaterialOptions([]);
          setProcessOptions([]);
          setTestReportOptions([]);
        }
        return;
      }

      try {
        const response = await fetch(`/api/qc/nonconformance/options?siteId=${siteId}`, { cache: "no-store" });
        const result = (await response.json()) as NonconformanceOptionsResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "NCR 옵션 조회 실패");
        }

        if (!cancelled) {
          setMaterialOptions(Array.isArray(result.data?.materialInspectionOptions) ? result.data.materialInspectionOptions : []);
          setProcessOptions(Array.isArray(result.data?.processInspectionOptions) ? result.data.processInspectionOptions : []);
          setTestReportOptions(Array.isArray(result.data?.testReportOptions) ? result.data.testReportOptions : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "NCR 옵션 조회 실패");
        }
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchDetail(ncrId: string) {
    const response = await fetch(`/api/qc/nonconformance/${ncrId}`, { cache: "no-store" });
    const result = (await response.json()) as NonconformanceDetailResponse;
    if (!result.ok || !result.data) {
      throw new Error(result.error ?? "NCR 상세 조회 실패");
    }
    return result.data;
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setMemberPickerTarget(null);
    setMemberQuery("");
    setUploadCategory("report");
    setUploadInputKey((previous) => previous + 1);
  }

  async function openCreateForm() {
    resetForm();
    setShowForm(true);
    setMessage(null);
    setError(null);
  }

  async function openEditForm(ncrId: string) {
    setShowForm(true);
    setIsFormLoading(true);
    setEditingId(ncrId);
    setMessage(null);
    setError(null);

    try {
      const detail = await fetchDetail(ncrId);
      setForm(mapDetailToForm(detail));
    } catch (err) {
      setError(err instanceof Error ? err.message : "NCR 편집 정보 조회 실패");
    } finally {
      setIsFormLoading(false);
    }
  }

  async function openDetail(ncrId: string) {
    setIsDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchDetail(ncrId);
      setSelectedItem(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "NCR 상세 조회 실패");
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleUpload(files: File[]) {
    if (!files.length) {
      return;
    }

    const siteId = readSiteId();
    if (!siteId) {
      setError("현장을 먼저 선택해 주세요.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setMessage(null);

    try {
      const uploadedAttachments: QcNonconformanceAttachment[] = [];

      for (const [index, file] of files.entries()) {
        const body = new FormData();
        body.append("file", file);
        body.append("module", "qc");
        body.append("siteId", siteId);
        if (user.userId) {
          body.append("uploadedBy", user.userId);
        }

        const response = await fetch("/api/files/upload", {
          method: "POST",
          body,
        });
        const result = (await response.json()) as UploadResponse;
        if (!result.ok || !result.data) {
          throw new Error(result.error ?? "첨부 업로드 실패");
        }

        uploadedAttachments.push({
          fileAssetId: result.data.fileAssetId,
          fileName: result.data.originalName,
          fileUrl: buildUploadUrl(result.data.storagePath),
          category: uploadCategory,
          sortOrder: form.attachments.length + index,
        });
      }

      setForm((previous) => ({
        ...previous,
        attachments: [...previous.attachments, ...uploadedAttachments].map((attachment, index) => ({
          ...attachment,
          sortOrder: index,
        })),
      }));
      setUploadInputKey((previous) => previous + 1);
      setMessage(`${uploadedAttachments.length}개의 첨부 파일을 등록했습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "첨부 업로드 실패");
    } finally {
      setIsUploading(false);
    }
  }

  function applyMember(member: SiteMemberOption) {
    if (!memberPickerTarget) {
      return;
    }

    setForm((previous) =>
      memberPickerTarget === "assignee"
        ? {
            ...previous,
            assigneeName: member.name,
            assigneeMemberId: member._id,
          }
        : {
            ...previous,
            verifierName: member.name,
            verifierMemberId: member._id,
          },
    );
    setMemberPickerTarget(null);
    setMemberQuery("");
  }

  function syncSourceSelections(nextSourceType: QcNonconformanceSourceType) {
    setForm((previous) => ({
      ...previous,
      sourceType: nextSourceType,
      linkedMaterialInspectionId: nextSourceType === "material_inspection" ? previous.linkedMaterialInspectionId : "",
      linkedProcessInspectionId: nextSourceType === "process_inspection" ? previous.linkedProcessInspectionId : "",
      linkedTestReportId: nextSourceType === "test_report" ? previous.linkedTestReportId : "",
      sourceSummary:
        nextSourceType === "material_inspection"
          ? previous.sourceSummary
          : nextSourceType === "process_inspection"
            ? previous.sourceSummary
            : nextSourceType === "test_report"
              ? previous.sourceSummary
              : previous.sourceSummary,
    }));
  }

  async function handleSubmit() {
    const siteId = readSiteId();
    if (!siteId) {
      setError("현장을 먼저 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(editingId ? `/api/qc/nonconformance/${editingId}` : "/api/qc/nonconformance", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          siteId,
          attachments: form.attachments.map((attachment, index) => ({
            fileAssetId: attachment.fileAssetId,
            fileName: attachment.fileName,
            category: attachment.category,
            sortOrder: index,
          })),
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "NCR 저장 실패");
      }

      setShowForm(false);
      resetForm();
      setMessage(editingId ? "NCR을 수정했습니다." : "NCR을 등록했습니다.");
      startTransition(() => setPage(1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "NCR 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    try {
      const response = await fetch(`/api/qc/nonconformance/${deleteTarget._id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "NCR 삭제 실패");
      }

      setDeleteTarget(null);
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
      setMessage("NCR을 삭제했습니다.");
      setItems((previous) => previous.filter((item) => item._id !== deleteTarget._id));
      startTransition(() => setPage(1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "NCR 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReminder(row: NonconformanceRow) {
    setRemindingId(row._id);
    setError(null);
    try {
      const response = await fetch(`/api/qc/nonconformance/${row._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historyNote: `기한 ${formatDate(row.dueDate)} 기준 리마인드`,
          reminderRequested: true,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "리마인드 기록 실패");
      }
      setMessage(`${row.ncrNo} 리마인드를 기록했습니다.`);
      startTransition(() => setPage(1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "리마인드 기록 실패");
    } finally {
      setRemindingId(null);
    }
  }

  const columns: DataTableColumn<NonconformanceRow>[] = [
    {
      key: "ncrNo",
      header: "NCR",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-foreground-muted">{row.ncrNo}</div>
          <div className="font-medium text-foreground">{row.title}</div>
          <div className="line-clamp-2 text-xs text-foreground-muted">{row.description || row.sourceSummary || "-"}</div>
        </div>
      ),
    },
    {
      key: "sourceType",
      header: "출처",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{QC_NONCONFORMANCE_SOURCE_TYPE_LABELS[row.sourceType]}</div>
          <div className="text-xs text-foreground-muted">{resolveSourceReferenceLabel(row)}</div>
        </div>
      ),
    },
    {
      key: "severity",
      header: "상태",
      render: (_value, row) => (
        <div className="space-y-1">
          <div>{renderSeverityPill(row.severity)}</div>
          <div>{renderStatusPill(row.status)}</div>
        </div>
      ),
    },
    {
      key: "dueDate",
      header: "담당 / 기한",
      render: (_value, row) => {
        const overdue = isQcNonconformanceOverdue({ dueDate: row.dueDate, status: row.status });
        const dueSoon = isQcNonconformanceDueSoon({ dueDate: row.dueDate, status: row.status, leadDays: QC_NONCONFORMANCE_REMINDER_DAYS });
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium text-foreground">{row.assigneeName || "미지정"}</div>
            <div className={`text-xs ${overdue ? "text-rose-700" : dueSoon ? "text-amber-700" : "text-foreground-muted"}`}>
              기한 {formatDate(row.dueDate)}
            </div>
          </div>
        );
      },
    },
    {
      key: "verificationResult",
      header: "검증",
      render: (_value, row) => (
        <div className="space-y-1">
          <div>{renderVerificationPill(row.verificationResult)}</div>
          <div className="text-xs text-foreground-muted">{row.verifierName || "미지정"}</div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "작업",
      render: (_value, row) => (
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void openEditForm(row._id);
              }}
              className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
            >
              수정
            </button>
          ) : null}
          {canManage && row.status !== "closed" ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void handleReminder(row);
              }}
              disabled={remindingId === row._id}
              className="rounded-md border border-amber-200 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-60"
            >
              {remindingId === row._id ? "기록 중..." : "리마인드"}
            </button>
          ) : null}
          {canManage ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteTarget({
                  _id: row._id,
                  ncrNo: row.ncrNo,
                  title: row.title,
                  severity: row.severity,
                  dueDate: row.dueDate,
                });
              }}
              className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
            >
              삭제
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const currentUserName = user.userName || "현재 사용자";
  const formOverdue = isQcNonconformanceOverdue({ dueDate: form.dueDate, status: form.status });
  const sourceReferenceLabel =
    form.sourceType === "material_inspection"
      ? selectedMaterial?.label || ""
      : form.sourceType === "process_inspection"
        ? selectedProcess?.label || ""
        : form.sourceType === "test_report"
          ? selectedTestReport?.label || ""
          : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">NCR 관리</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            부적합 등록부터 원인분석, 시정조치, 검증 완료까지 현장 기준으로 추적합니다.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => void openCreateForm()}
            className="rounded-md bg-[#ecebe8] px-4 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
          >
            NCR 등록
          </button>
        ) : null}
      </div>

      <QcFeedbackBanners message={message} error={error} />

      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-foreground-muted">진행중 NCR</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{summary.activeCount}건</p>
          <p className="mt-1 text-xs text-foreground-muted">종결 전 상태 기준</p>
        </div>
        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-foreground-muted">검증 대기</p>
          <p className="mt-2 text-2xl font-semibold text-violet-700">{summary.verificationCount}건</p>
          <p className="mt-1 text-xs text-foreground-muted">재검 또는 종료 판정 대기</p>
        </div>
        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-foreground-muted">기한 경과</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">{summary.overdueCount}건</p>
          <p className="mt-1 text-xs text-foreground-muted">알림 벨과 리마인드 대상</p>
        </div>
        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-foreground-muted">치명 NCR</p>
          <p className="mt-2 text-2xl font-semibold text-orange-700">{summary.criticalCount}건</p>
          <p className="mt-1 text-xs text-foreground-muted">우선 조치 필요 항목</p>
        </div>
      </section>

      <QcFilterPanel
        description="NCR 번호, 제목, 출처 요약, 참조 검사, 담당자 기준으로 검색하고 지연 건을 빠르게 추릴 수 있습니다."
        actions={
          <QcSortSelect
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={(value) => {
              setSortBy(value as QcNonconformanceSort);
              startTransition(() => setPage(1));
            }}
            compact
          />
        }
      >
        <div className="grid gap-3 md:grid-cols-5">
          <FormInput
            label="검색"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              startTransition(() => setPage(1));
            }}
            placeholder="NCR 번호, 제목, 출처, 담당자"
          />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">상태</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "all" | QcNonconformanceStatus);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_NONCONFORMANCE_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {QC_NONCONFORMANCE_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">심각도</span>
            <select
              value={severityFilter}
              onChange={(event) => {
                setSeverityFilter(event.target.value as "all" | QcNonconformanceSeverity);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_NONCONFORMANCE_SEVERITY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {QC_NONCONFORMANCE_SEVERITY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">출처</span>
            <select
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value as "all" | QcNonconformanceSourceType);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_NONCONFORMANCE_SOURCE_TYPE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {QC_NONCONFORMANCE_SOURCE_TYPE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => {
                setOverdueOnly(event.target.checked);
                startTransition(() => setPage(1));
              }}
              className="mt-0.5"
            />
            <span>지연 NCR만 보기</span>
          </label>
        </div>
      </QcFilterPanel>

      {showForm ? (
        <section className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{editingId ? "NCR 수정" : "NCR 등록"}</h2>
              <p className="text-sm text-foreground-muted">부적합 내용, 원인, 조치계획, 검증정보를 함께 관리합니다.</p>
            </div>
            <div className="rounded-lg border border-border bg-background-soft px-3 py-2 text-sm text-foreground-muted">
              NCR 번호는 저장 시 자동 생성됩니다.
            </div>
          </div>

          {isFormLoading ? (
            <div className="mt-4 rounded-lg border border-border bg-background-soft px-4 py-8 text-center text-sm text-foreground-muted">
              편집 정보를 불러오는 중입니다.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-background-soft px-3 py-2">
                  <p className="text-xs font-medium text-foreground-muted">등록자</p>
                  <p className="mt-1 text-sm text-foreground">{currentUserName}</p>
                </div>
                <div className="rounded-lg border border-border bg-background-soft px-3 py-2">
                  <p className="text-xs font-medium text-foreground-muted">예상 리마인드 기준</p>
                  <p className="mt-1 text-sm text-foreground">기한 {QC_NONCONFORMANCE_REMINDER_DAYS}일 전 및 기한 경과</p>
                </div>
                <div className={`rounded-lg border px-3 py-2 ${formOverdue ? "border-rose-200 bg-rose-50" : "border-border bg-background-soft"}`}>
                  <p className="text-xs font-medium text-foreground-muted">현재 상태</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {renderSeverityPill(form.severity)}
                    {renderStatusPill(form.status)}
                    {renderVerificationPill(form.verificationResult)}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">발생 구분</span>
                  <select
                    value={form.occurrenceType}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        occurrenceType: event.target.value as QcNonconformanceOccurrenceType,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    {QC_NONCONFORMANCE_OCCURRENCE_TYPE_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {QC_NONCONFORMANCE_OCCURRENCE_TYPE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">출처 유형</span>
                  <select
                    value={form.sourceType}
                    onChange={(event) => syncSourceSelections(event.target.value as QcNonconformanceSourceType)}
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    {QC_NONCONFORMANCE_SOURCE_TYPE_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {QC_NONCONFORMANCE_SOURCE_TYPE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">심각도</span>
                  <select
                    value={form.severity}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        severity: event.target.value as QcNonconformanceSeverity,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    {QC_NONCONFORMANCE_SEVERITY_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {QC_NONCONFORMANCE_SEVERITY_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <FormInput
                  label="발생일"
                  type="date"
                  value={form.occurrenceDate}
                  onChange={(event) => setForm((previous) => ({ ...previous, occurrenceDate: event.target.value }))}
                />
                <FormInput
                  label="조치 기한"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm((previous) => ({ ...previous, dueDate: event.target.value }))}
                />
                <FormInput
                  label="위치"
                  value={form.location}
                  onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))}
                  placeholder="예: B동 3층 슬라브"
                />
                <FormInput
                  label="공종"
                  value={form.workType}
                  onChange={(event) => setForm((previous) => ({ ...previous, workType: event.target.value }))}
                  placeholder="예: 철근콘크리트"
                />
                <FormInput
                  label="제목"
                  value={form.title}
                  onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="예: 압축강도 시험 기준치 미달"
                />
                <div className="rounded-lg border border-border bg-background-soft px-3 py-2">
                  <p className="text-xs font-medium text-foreground-muted">선택된 참조</p>
                  <p className="mt-1 text-sm text-foreground">{sourceReferenceLabel || "직접 등록 또는 미선택"}</p>
                </div>
              </div>

              {form.sourceType !== "manual" ? (
                <div className="rounded-lg border border-border bg-background-soft p-4">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">참조 연결</h3>
                      <p className="text-xs text-foreground-muted">출처 유형에 맞는 검사/성적서를 선택하면 제목과 출처 요약의 기준 데이터로 사용합니다.</p>
                    </div>
                    <Link href={form.sourceType === "material_inspection" ? "/qc/material-inspection" : form.sourceType === "process_inspection" ? "/qc/process-inspection" : "/qc/test-reports"} className="text-xs font-medium text-sky-700 hover:underline">
                      참조 화면 열기
                    </Link>
                  </div>
                  <div className="mt-3">
                    {form.sourceType === "material_inspection" ? (
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">자재 검사</span>
                        <select
                          value={form.linkedMaterialInspectionId}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              linkedMaterialInspectionId: event.target.value,
                              sourceSummary:
                                materialOptions.find((option) => option._id === event.target.value)?.label || previous.sourceSummary,
                            }))
                          }
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        >
                          <option value="">선택 안함</option>
                          {materialOptions.map((option) => (
                            <option key={option._id} value={option._id}>
                              {option.label}
                              {option.ncrReference ? ` · 연결 ${option.ncrReference}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {form.sourceType === "process_inspection" ? (
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">공정 검사</span>
                        <select
                          value={form.linkedProcessInspectionId}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              linkedProcessInspectionId: event.target.value,
                              sourceSummary:
                                processOptions.find((option) => option._id === event.target.value)?.label || previous.sourceSummary,
                            }))
                          }
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        >
                          <option value="">선택 안함</option>
                          {processOptions.map((option) => (
                            <option key={option._id} value={option._id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {form.sourceType === "test_report" ? (
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">시험 성적서</span>
                        <select
                          value={form.linkedTestReportId}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              linkedTestReportId: event.target.value,
                              sourceSummary:
                                testReportOptions.find((option) => option._id === event.target.value)?.label || previous.sourceSummary,
                            }))
                          }
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        >
                          <option value="">선택 안함</option>
                          {testReportOptions.map((option) => (
                            <option key={option._id} value={option._id}>
                              {option.label}
                              {option.ncrReference ? ` · 연결 ${option.ncrReference}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">부적합 내용</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                  className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                  placeholder="현장 상황, 기준 위반 내용, 영향 범위를 기록하세요."
                />
              </label>

              <FormInput
                label="출처 요약"
                value={form.sourceSummary}
                onChange={(event) => setForm((previous) => ({ ...previous, sourceSummary: event.target.value }))}
                placeholder="예: 콘크리트 강도 시험 성적서 7일차 결과"
              />

              <div className="grid gap-3 md:grid-cols-2">
                {(["assignee", "verifier"] as const).map((target) => {
                  const label = target === "assignee" ? "조치 담당자" : "검증자";
                  const memberId = target === "assignee" ? form.assigneeMemberId : form.verifierMemberId;
                  const memberName = target === "assignee" ? form.assigneeName : form.verifierName;
                  const selectedMember = findMemberById(memberOptions, memberId);

                  return (
                    <div key={target} className="space-y-2 rounded-lg border border-border bg-background-soft p-3">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-sm text-foreground-muted">{formatSiteMemberSummary(selectedMember, memberName) || "미지정"}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setMemberPickerTarget(target);
                          setMemberQuery("");
                        }}
                        className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background-card"
                      >
                        현장 인력 선택
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">원인분석</span>
                  <textarea
                    value={form.rootCauseSummary}
                    onChange={(event) => setForm((previous) => ({ ...previous, rootCauseSummary: event.target.value }))}
                    className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                    placeholder="원인 가설, 기준 미준수 원인, 책임 공정 등을 기록하세요."
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">임시조치</span>
                  <textarea
                    value={form.containmentAction}
                    onChange={(event) => setForm((previous) => ({ ...previous, containmentAction: event.target.value }))}
                    className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                    placeholder="격리, 반출, 작업 중지, 표시 등 즉시 조치 내용을 적습니다."
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">시정조치 계획</span>
                  <textarea
                    value={form.correctiveActionPlan}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, correctiveActionPlan: event.target.value }))
                    }
                    className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                    placeholder="누가, 언제, 무엇을 보완할지 계획을 남깁니다."
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">재발방지 대책</span>
                  <textarea
                    value={form.preventiveAction}
                    onChange={(event) => setForm((previous) => ({ ...previous, preventiveAction: event.target.value }))}
                    className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                    placeholder="표준 개정, 교육, 체크리스트 보완 등 재발방지 방안을 적습니다."
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">조치 결과</span>
                  <textarea
                    value={form.actionTaken}
                    onChange={(event) => setForm((previous) => ({ ...previous, actionTaken: event.target.value }))}
                    className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                    placeholder="실제 조치 완료 내용과 증빙 근거를 남깁니다."
                  />
                </label>
                <div className="space-y-3 rounded-lg border border-border bg-background-soft p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">상태</span>
                      <select
                        value={form.status}
                        onChange={(event) => {
                          const nextStatus = event.target.value as QcNonconformanceStatus;
                          setForm((previous) => ({
                            ...previous,
                            status: nextStatus,
                            verificationResult:
                              nextStatus === "closed" && previous.verificationResult === "pending"
                                ? "pass"
                                : previous.verificationResult,
                          }));
                        }}
                        className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                      >
                        {QC_NONCONFORMANCE_STATUS_VALUES.filter(
                          (value) => !editingId || value === form.status || QC_NONCONFORMANCE_STATUS_TRANSITIONS[form.status].includes(value),
                        ).map((value) => (
                          <option key={value} value={value}>
                            {QC_NONCONFORMANCE_STATUS_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">검증 결과</span>
                      <select
                        value={form.verificationResult}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            verificationResult: event.target.value as QcNonconformanceVerificationResult,
                          }))
                        }
                        className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                      >
                        {QC_NONCONFORMANCE_VERIFICATION_RESULT_VALUES.map((value) => (
                          <option key={value} value={value}>
                            {QC_NONCONFORMANCE_VERIFICATION_RESULT_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <FormInput
                      label="검증일"
                      type="date"
                      value={form.verifiedAt}
                      onChange={(event) => setForm((previous) => ({ ...previous, verifiedAt: event.target.value }))}
                    />
                    <FormInput
                      label="이력 메모"
                      value={form.historyNote}
                      onChange={(event) => setForm((previous) => ({ ...previous, historyNote: event.target.value }))}
                      placeholder="상태 변경, 조치 완료, 검증 메모"
                    />
                  </div>
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-foreground">검증 메모</span>
                    <textarea
                      value={form.verificationNote}
                      onChange={(event) => setForm((previous) => ({ ...previous, verificationNote: event.target.value }))}
                      className="min-h-20 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                      placeholder="재검 결과, 종료 판단 근거를 기록하세요."
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background-soft p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">증빙 첨부</h3>
                    <p className="text-xs text-foreground-muted">사진, 보고서, 체크시트, 성적서를 다건 첨부합니다.</p>
                  </div>
                  <label className="space-y-1 md:w-48">
                    <span className="block text-xs font-medium text-foreground-muted">업로드 구분</span>
                    <select
                      value={uploadCategory}
                      onChange={(event) => setUploadCategory(event.target.value as QcAttachmentCategory)}
                      className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                    >
                      {QC_NONCONFORMANCE_ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 space-y-3">
                  <FileUpload
                    key={uploadInputKey}
                    label="증빙 첨부"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    multiple
                    onFilesChange={handleUpload}
                  />
                  {form.attachments.length > 0 ? (
                    <div className="space-y-2">
                      {form.attachments.map((attachment, index) => (
                        <div
                          key={`${attachment.fileAssetId}-${index}`}
                          className="grid gap-3 rounded-md border border-border bg-background-card px-3 py-2 md:grid-cols-[minmax(0,1.6fr)_160px_auto_auto]"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">{attachment.fileName}</div>
                            <div className="text-xs text-foreground-muted">
                              {attachment.fileUrl ? "첨부 링크 준비됨" : "업로드 정보만 저장"}
                            </div>
                          </div>
                          <label className="space-y-1">
                            <span className="block text-xs font-medium text-foreground-muted">구분</span>
                            <select
                              value={attachment.category}
                              onChange={(event) =>
                                setForm((previous) => ({
                                  ...previous,
                                  attachments: previous.attachments.map((currentAttachment, attachmentIndex) =>
                                    attachmentIndex === index
                                      ? {
                                          ...currentAttachment,
                                          category: event.target.value as QcAttachmentCategory,
                                        }
                                      : currentAttachment,
                                  ),
                                }))
                              }
                              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                            >
                              {QC_NONCONFORMANCE_ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="flex items-end">
                            {attachment.fileUrl ? (
                              <a
                                href={attachment.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-background-soft"
                              >
                                열기
                              </a>
                            ) : (
                              <span className="rounded-md border border-border px-3 py-2 text-xs text-foreground-muted">
                                링크 없음
                              </span>
                            )}
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() =>
                                setForm((previous) => ({
                                  ...previous,
                                  attachments: previous.attachments
                                    .filter((_, attachmentIndex) => attachmentIndex !== index)
                                    .map((currentAttachment, attachmentIndex) => ({
                                      ...currentAttachment,
                                      sortOrder: attachmentIndex,
                                    })),
                                }))
                              }
                              className="rounded-md border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                              제거
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="rounded-md border border-border px-4 py-1.5 text-sm text-foreground hover:bg-background-soft"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || isUploading || isFormLoading}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "저장"}
            </button>
          </div>
        </section>
      ) : null}

      <DataTable
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "NCR 목록을 불러오는 중입니다." : "등록된 NCR이 없습니다."}
        onRowClick={(row) => {
          void openDetail(row._id);
        }}
        getRowAriaLabel={(row) => `${row.ncrNo} 상세 열기`}
      />

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal
        open={Boolean(selectedItem) || isDetailLoading}
        title={selectedItem ? `${selectedItem.ncrNo} 상세` : "NCR 상세"}
        onClose={() => {
          setSelectedItem(null);
        }}
      >
        {isDetailLoading ? (
          <p className="text-sm text-foreground-muted">상세 정보를 불러오는 중입니다.</p>
        ) : selectedItem ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {renderSeverityPill(selectedItem.severity)}
              {renderStatusPill(selectedItem.status)}
              {renderVerificationPill(selectedItem.verificationResult)}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <dl className="space-y-3 rounded-lg border border-border bg-background-soft p-4 text-sm">
                <div>
                  <dt className="text-xs font-medium text-foreground-muted">제목</dt>
                  <dd className="mt-1 text-foreground">{selectedItem.title}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-foreground-muted">발생 구분</dt>
                  <dd className="mt-1 text-foreground">{QC_NONCONFORMANCE_OCCURRENCE_TYPE_LABELS[selectedItem.occurrenceType]}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-foreground-muted">출처</dt>
                  <dd className="mt-1 text-foreground">{QC_NONCONFORMANCE_SOURCE_TYPE_LABELS[selectedItem.sourceType]}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-foreground-muted">출처 요약</dt>
                  <dd className="mt-1 text-foreground">{resolveSourceReferenceLabel(selectedItem)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-foreground-muted">등록자</dt>
                  <dd className="mt-1 text-foreground">{selectedItem.reporterName || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-foreground-muted">조치 담당자</dt>
                  <dd className="mt-1 text-foreground">{selectedItem.assigneeName || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-foreground-muted">검증자</dt>
                  <dd className="mt-1 text-foreground">{selectedItem.verifierName || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-foreground-muted">발생일 / 기한</dt>
                  <dd className="mt-1 text-foreground">
                    {formatDate(selectedItem.occurrenceDate)} / {formatDate(selectedItem.dueDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-foreground-muted">검증일 / 종결일</dt>
                  <dd className="mt-1 text-foreground">
                    {formatDate(selectedItem.verifiedAt)} / {formatDate(selectedItem.closedAt)}
                  </dd>
                </div>
              </dl>

              <div className="space-y-3 rounded-lg border border-border bg-background-soft p-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-foreground-muted">부적합 내용</p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{selectedItem.description || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">원인분석</p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{selectedItem.rootCauseSummary || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">임시조치</p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{selectedItem.containmentAction || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">시정조치 계획</p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{selectedItem.correctiveActionPlan || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">재발방지 대책</p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{selectedItem.preventiveAction || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground-muted">조치 결과 / 검증 메모</p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">
                    {(selectedItem.actionTaken || "-") + "\n" + (selectedItem.verificationNote || "-")}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-background-soft p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">참조 연결</h3>
                  <Link
                    href={
                      selectedItem.sourceType === "material_inspection"
                        ? "/qc/material-inspection"
                        : selectedItem.sourceType === "process_inspection"
                          ? "/qc/process-inspection"
                          : selectedItem.sourceType === "test_report"
                            ? "/qc/test-reports"
                            : "/qc/nonconformance"
                    }
                    className="text-xs font-medium text-sky-700 hover:underline"
                  >
                    참조 화면 열기
                  </Link>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-foreground-muted">자재 검사</dt>
                    <dd className="mt-1 text-foreground">{selectedItem.linkedMaterialInspectionTitle || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-foreground-muted">공정 검사</dt>
                    <dd className="mt-1 text-foreground">{selectedItem.linkedProcessInspectionTitle || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-foreground-muted">시험 성적서</dt>
                    <dd className="mt-1 text-foreground">{selectedItem.linkedTestReportTitle || "-"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-border bg-background-soft p-4">
                <h3 className="text-sm font-semibold text-foreground">첨부</h3>
                {selectedItem.attachments.length ? (
                  <ul className="mt-3 space-y-2">
                    {selectedItem.attachments.map((attachment) => (
                      <li
                        key={attachment.fileAssetId}
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-background-card px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{attachment.fileName}</p>
                          <p className="text-xs text-foreground-muted">
                            {QC_ATTACHMENT_CATEGORY_LABELS[attachment.category]} · 순서 {attachment.sortOrder + 1}
                          </p>
                        </div>
                        {attachment.fileUrl ? (
                          <a
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background-soft"
                          >
                            열기
                          </a>
                        ) : (
                          <span className="text-xs text-foreground-muted">링크 없음</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-foreground-muted">첨부된 증빙이 없습니다.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <h3 className="text-sm font-semibold text-foreground">이력</h3>
              {selectedItem.history.length ? (
                <ul className="mt-3 space-y-2">
                  {selectedItem.history
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <li key={`${entry.actionDate}-${index}`} className="rounded-md border border-border bg-background-card px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">
                            {QC_NONCONFORMANCE_HISTORY_ACTION_LABELS[entry.actionType as QcNonconformanceHistoryAction] ?? entry.actionType}
                          </span>
                          {renderStatusPill(entry.status)}
                          {renderVerificationPill(entry.verificationResult)}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-foreground-muted">{entry.note || "-"}</p>
                        <p className="mt-1 text-xs text-foreground-muted">
                          {entry.actorName || "시스템"} · {formatDateTime(entry.actionDate)}
                        </p>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-foreground-muted">기록된 이력이 없습니다.</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="NCR 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4 text-sm text-foreground">
            <p>
              <strong>{deleteTarget.ncrNo}</strong> {deleteTarget.title} 항목을 삭제합니다.
            </p>
            <p className="text-foreground-muted">
              심각도 {QC_NONCONFORMANCE_SEVERITY_LABELS[deleteTarget.severity]} / 기한 {formatDate(deleteTarget.dueDate)}
            </p>
            <p className="text-foreground-muted">연결된 자재 검사 또는 시험 성적서의 NCR 참조도 함께 해제됩니다.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="rounded-md border border-border px-4 py-1.5 text-sm text-foreground hover:bg-background-soft"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={Boolean(deletingId)}
                className="rounded-md border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                {deletingId ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(memberPickerTarget)}
        title={memberPickerTarget === "assignee" ? "조치 담당자 선택" : "검증자 선택"}
        onClose={() => setMemberPickerTarget(null)}
      >
        <div className="space-y-3">
          <FormInput
            label="검색"
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder="이름, 직책, 회사명"
          />
          {memberError ? <p className="text-sm text-rose-700">{memberError}</p> : null}
          {isMemberLoading ? (
            <p className="text-sm text-foreground-muted">현장 인력 목록을 불러오는 중입니다.</p>
          ) : filteredMembers.length ? (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {filteredMembers.map((member) => (
                <button
                  key={member._id}
                  type="button"
                  onClick={() => applyMember(member)}
                  className="block w-full rounded-md border border-border bg-background-card px-3 py-2 text-left text-sm hover:bg-background-soft"
                >
                  <p className="font-medium text-foreground">{member.name}</p>
                  <p className="mt-1 text-xs text-foreground-muted">{formatSiteMemberSummary(member, member.name)}</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">조건에 맞는 현장 인력이 없습니다.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
