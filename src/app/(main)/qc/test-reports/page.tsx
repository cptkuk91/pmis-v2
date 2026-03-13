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
  QC_TEST_REPORT_ATTACHMENT_CATEGORY_OPTIONS,
  QC_TEST_REPORT_HISTORY_ACTION_LABELS,
  QC_TEST_REPORT_JUDGEMENT_RULE_LABELS,
  QC_TEST_REPORT_JUDGEMENT_RULE_OPTIONS,
  QC_TEST_REPORT_NCR_STATUS_LABELS,
  QC_TEST_REPORT_NCR_STATUS_OPTIONS,
  QC_TEST_REPORT_RESULT_LABELS,
  QC_TEST_REPORT_RESULT_OPTIONS,
  QC_TEST_REPORT_SORT_LABELS,
  QC_TEST_REPORT_SORT_VALUES,
  QC_TEST_REPORT_SOURCE_TYPE_LABELS,
  QC_TEST_REPORT_SOURCE_TYPE_OPTIONS,
  QC_TEST_REPORT_STATUS_LABELS,
  QC_TEST_REPORT_STATUS_OPTIONS,
  QC_TEST_REPORT_TYPE_LABELS,
  QC_TEST_REPORT_TYPE_OPTIONS,
  computeQcTestReportEvaluation,
  type QcTestReportAttachment,
  type QcTestReportHistoryAction,
  type QcTestReportHistoryEntry,
  type QcTestReportJudgementRule,
  type QcTestReportNcrStatus,
  type QcTestReportResult,
  type QcTestReportSort,
  type QcTestReportSourceType,
  type QcTestReportStatus,
  type QcTestReportType,
} from "@/lib/qc-test-reports";

type MaterialInspectionOption = {
  _id: string;
  label: string;
  materialName: string;
  specification: string;
  inspectionDate: string;
  result: string;
};

type ProcessInspectionOption = {
  _id: string;
  label: string;
  inspectionTitle: string;
  location: string;
  plannedInspectionDate: string;
  result: string;
  status: string;
};

type TestReportRow = {
  _id: string;
  testType: QcTestReportType;
  sourceType: QcTestReportSourceType;
  sampleName: string;
  specimenNo: string;
  samplingLocation: string;
  samplingDate: string;
  testDate: string;
  linkedMaterialInspectionId: string;
  linkedMaterialInspectionTitle: string;
  linkedProcessInspectionId: string;
  linkedProcessInspectionTitle: string;
  standardValue: number;
  measuredValue: number;
  toleranceValue: number;
  unit: string;
  judgementRule: QcTestReportJudgementRule;
  result: QcTestReportResult;
  deviationValue: number;
  deviationRate: number;
  testingAgency: string;
  certificateNo: string;
  versionNo: number;
  status: QcTestReportStatus;
  reporterName: string;
  reviewerName: string;
  reviewerMemberId: string;
  approverName: string;
  approverMemberId: string;
  summary: string;
  attachments: QcTestReportAttachment[];
  ncrStatus: QcTestReportNcrStatus;
  ncrReference: string;
  history: QcTestReportHistoryEntry[];
  updatedAt?: string;
  actions?: string;
};

type TestReportForm = {
  testType: QcTestReportType;
  sourceType: QcTestReportSourceType;
  sampleName: string;
  specimenNo: string;
  samplingLocation: string;
  samplingDate: string;
  testDate: string;
  linkedMaterialInspectionId: string;
  linkedProcessInspectionId: string;
  standardValue: string;
  measuredValue: string;
  toleranceValue: string;
  unit: string;
  judgementRule: QcTestReportJudgementRule;
  testingAgency: string;
  certificateNo: string;
  versionNo: string;
  status: QcTestReportStatus;
  reviewerName: string;
  reviewerMemberId: string;
  approverName: string;
  approverMemberId: string;
  summary: string;
  attachments: QcTestReportAttachment[];
  ncrStatus: QcTestReportNcrStatus;
  ncrReference: string;
  historyNote: string;
};

type TestReportResponse = {
  ok: boolean;
  data: TestReportRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type TestReportDetailResponse = {
  ok: boolean;
  data?: TestReportRow;
  error?: string;
};

type TestReportOptionsResponse = {
  ok: boolean;
  data?: {
    materialInspectionOptions?: MaterialInspectionOption[];
    processInspectionOptions?: ProcessInspectionOption[];
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

type DeleteTarget = Pick<TestReportRow, "_id" | "sampleName" | "testDate">;
type MemberPickerTarget = "reviewer" | "approver" | null;

const SITE_ID_KEY = "pmis:siteId";
const SORT_OPTIONS = QC_TEST_REPORT_SORT_VALUES.map((value) => ({
  value,
  label: QC_TEST_REPORT_SORT_LABELS[value],
}));

function createEmptyForm(): TestReportForm {
  return {
    testType: "other",
    sourceType: "manual",
    sampleName: "",
    specimenNo: "",
    samplingLocation: "",
    samplingDate: "",
    testDate: "",
    linkedMaterialInspectionId: "",
    linkedProcessInspectionId: "",
    standardValue: "0",
    measuredValue: "0",
    toleranceValue: "0",
    unit: "",
    judgementRule: "minimum",
    testingAgency: "",
    certificateNo: "",
    versionNo: "1",
    status: "draft",
    reviewerName: "",
    reviewerMemberId: "",
    approverName: "",
    approverMemberId: "",
    summary: "",
    attachments: [],
    ncrStatus: "none",
    ncrReference: "",
    historyNote: "",
  };
}

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

function parseNumeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderStatusPill(status: QcTestReportStatus) {
  const toneClass =
    status === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "reviewed"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : status === "submitted"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_TEST_REPORT_STATUS_LABELS[status]}
    </span>
  );
}

function renderResultPill(result: QcTestReportResult) {
  const toneClass =
    result === "pass"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : result === "fail"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_TEST_REPORT_RESULT_LABELS[result]}
    </span>
  );
}

function renderNcrPill(status: QcTestReportNcrStatus) {
  const toneClass =
    status === "linked"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : status === "recommended"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_TEST_REPORT_NCR_STATUS_LABELS[status]}
    </span>
  );
}

function mapDetailToForm(item: TestReportRow): TestReportForm {
  return {
    testType: item.testType,
    sourceType: item.sourceType,
    sampleName: item.sampleName,
    specimenNo: item.specimenNo,
    samplingLocation: item.samplingLocation,
    samplingDate: formatDate(item.samplingDate),
    testDate: formatDate(item.testDate),
    linkedMaterialInspectionId: item.linkedMaterialInspectionId,
    linkedProcessInspectionId: item.linkedProcessInspectionId,
    standardValue: String(item.standardValue ?? 0),
    measuredValue: String(item.measuredValue ?? 0),
    toleranceValue: String(item.toleranceValue ?? 0),
    unit: item.unit,
    judgementRule: item.judgementRule,
    testingAgency: item.testingAgency,
    certificateNo: item.certificateNo,
    versionNo: String(item.versionNo ?? 1),
    status: item.status,
    reviewerName: item.reviewerName,
    reviewerMemberId: item.reviewerMemberId,
    approverName: item.approverName,
    approverMemberId: item.approverMemberId,
    summary: item.summary,
    attachments:
      item.attachments?.map((attachment, index) => ({
        fileAssetId: attachment.fileAssetId,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        category: attachment.category,
        sortOrder: Number(attachment.sortOrder ?? index),
      })) ?? [],
    ncrStatus: item.ncrStatus,
    ncrReference: item.ncrReference,
    historyNote: "",
  };
}

function findMemberById(options: SiteMemberOption[], memberId: string) {
  return options.find((option) => option._id === memberId) ?? null;
}

export default function QcTestReportsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = hasMinRole(user.role, "manager");
  const {
    memberOptions,
    filteredMembers,
    memberQuery,
    setMemberQuery,
    isMemberLoading,
    memberError,
  } = useSiteMembers(canManage);

  const [items, setItems] = useState<TestReportRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const [statusFilter, setStatusFilter] = useState<"all" | QcTestReportStatus>("all");
  const [resultFilter, setResultFilter] = useState<"all" | QcTestReportResult>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | QcTestReportSourceType>("all");
  const [sortBy, setSortBy] = useState<QcTestReportSort>("test_date_desc");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TestReportForm>(() => createEmptyForm());
  const [selectedItem, setSelectedItem] = useState<TestReportRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [materialOptions, setMaterialOptions] = useState<MaterialInspectionOption[]>([]);
  const [processOptions, setProcessOptions] = useState<ProcessInspectionOption[]>([]);
  const [memberPickerTarget, setMemberPickerTarget] = useState<MemberPickerTarget>(null);
  const [uploadCategory, setUploadCategory] = useState<QcAttachmentCategory>("certificate");
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formEvaluation = computeQcTestReportEvaluation({
    standardValue: parseNumeric(form.standardValue),
    measuredValue: parseNumeric(form.measuredValue),
    toleranceValue: parseNumeric(form.toleranceValue),
    judgementRule: form.judgementRule,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      const siteId = readSiteId();
      if (!siteId) {
        if (!cancelled) {
          setItems([]);
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
        if (resultFilter !== "all") {
          params.set("result", resultFilter);
        }
        if (sourceFilter !== "all") {
          params.set("sourceType", sourceFilter);
        }

        const response = await fetch(`/api/qc/test-reports?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as TestReportResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "시험 성적서 목록 조회 실패");
        }

        if (!cancelled) {
          setItems(Array.isArray(result.data) ? result.data : []);
          setPage(result.meta?.page ?? page);
          setTotalPages(result.meta?.totalPages ?? 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "시험 성적서 목록 조회 실패");
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
  }, [page, deferredKeyword, sortBy, statusFilter, resultFilter, sourceFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const siteId = readSiteId();
      if (!siteId) {
        if (!cancelled) {
          setMaterialOptions([]);
          setProcessOptions([]);
        }
        return;
      }

      try {
        const response = await fetch(`/api/qc/test-reports/options?siteId=${siteId}`, { cache: "no-store" });
        const result = (await response.json()) as TestReportOptionsResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "시험 성적서 옵션 조회 실패");
        }

        if (!cancelled) {
          setMaterialOptions(Array.isArray(result.data?.materialInspectionOptions) ? result.data?.materialInspectionOptions : []);
          setProcessOptions(Array.isArray(result.data?.processInspectionOptions) ? result.data?.processInspectionOptions : []);
        }
      } catch (err) {
        if (!cancelled) {
          setMaterialOptions([]);
          setProcessOptions([]);
          setError(err instanceof Error ? err.message : "시험 성적서 옵션 조회 실패");
        }
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchDetail(reportId: string) {
    const response = await fetch(`/api/qc/test-reports/${reportId}`, { cache: "no-store" });
    const result = (await response.json()) as TestReportDetailResponse;
    if (!result.ok || !result.data) {
      throw new Error(result.error ?? "시험 성적서 상세 조회 실패");
    }
    return result.data;
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setMemberPickerTarget(null);
    setMemberQuery("");
    setUploadCategory("certificate");
    setUploadInputKey((previous) => previous + 1);
  }

  async function openCreateForm() {
    resetForm();
    setShowForm(true);
    setMessage(null);
    setError(null);
  }

  async function openEditForm(reportId: string) {
    setShowForm(true);
    setIsFormLoading(true);
    setEditingId(reportId);
    setMessage(null);
    setError(null);

    try {
      const detail = await fetchDetail(reportId);
      setForm(mapDetailToForm(detail));
    } catch (err) {
      setError(err instanceof Error ? err.message : "시험 성적서 편집 정보 조회 실패");
    } finally {
      setIsFormLoading(false);
    }
  }

  async function openDetail(reportId: string) {
    setIsDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchDetail(reportId);
      setSelectedItem(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "시험 성적서 상세 조회 실패");
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
      const uploadedAttachments: QcTestReportAttachment[] = [];

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
      memberPickerTarget === "reviewer"
        ? {
            ...previous,
            reviewerName: member.name,
            reviewerMemberId: member._id,
          }
        : {
            ...previous,
            approverName: member.name,
            approverMemberId: member._id,
          },
    );
    setMemberPickerTarget(null);
    setMemberQuery("");
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
      const response = await fetch(editingId ? `/api/qc/test-reports/${editingId}` : "/api/qc/test-reports", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          siteId,
          standardValue: parseNumeric(form.standardValue),
          measuredValue: parseNumeric(form.measuredValue),
          toleranceValue: parseNumeric(form.toleranceValue),
          versionNo: parseNumeric(form.versionNo) || 1,
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
        throw new Error(result.error ?? "시험 성적서 저장 실패");
      }

      setShowForm(false);
      resetForm();
      setMessage(editingId ? "시험 성적서를 수정했습니다." : "시험 성적서를 등록했습니다.");
      startTransition(() => setPage(1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "시험 성적서 저장 실패");
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
      const response = await fetch(`/api/qc/test-reports/${deleteTarget._id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "시험 성적서 삭제 실패");
      }

      setDeleteTarget(null);
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
      setMessage("시험 성적서를 삭제했습니다.");
      setItems((previous) => previous.filter((item) => item._id !== deleteTarget._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "시험 성적서 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const pendingReviewCount = items.filter((item) => item.status === "submitted").length;
  const failingCount = items.filter((item) => item.result === "fail").length;
  const ncrRecommendedCount = items.filter((item) => item.ncrStatus === "recommended").length;

  const columns: DataTableColumn<TestReportRow>[] = [
    {
      key: "sampleName",
      header: "시험 성적서",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="font-medium text-foreground">{row.sampleName}</div>
          <div className="text-xs text-foreground-muted">
            {QC_TEST_REPORT_TYPE_LABELS[row.testType]}
            {row.specimenNo ? ` / 시료 ${row.specimenNo}` : ""}
          </div>
          <div className="text-xs text-foreground-muted">{row.samplingLocation || "채취 위치 미입력"}</div>
        </div>
      ),
    },
    {
      key: "sourceType",
      header: "참조",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-xs text-foreground-muted">{QC_TEST_REPORT_SOURCE_TYPE_LABELS[row.sourceType]}</div>
          <div className="text-sm font-medium text-foreground">
            {row.linkedMaterialInspectionTitle || row.linkedProcessInspectionTitle || "직접 등록"}
          </div>
        </div>
      ),
    },
    {
      key: "testDate",
      header: "일정",
      className: "w-36",
      render: (_value, row) => (
        <div className="space-y-1 text-sm text-foreground">
          <div>채취 {formatDate(row.samplingDate)}</div>
          <div>시험 {formatDate(row.testDate)}</div>
        </div>
      ),
    },
    {
      key: "measuredValue",
      header: "기준 / 실측",
      className: "w-48",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-sm text-foreground">
            기준 {row.standardValue} {row.unit}
          </div>
          <div className="text-sm text-foreground">
            실측 {row.measuredValue} {row.unit}
          </div>
          <div className={`text-xs ${row.result === "fail" ? "text-rose-700" : "text-foreground-muted"}`}>
            편차 {row.deviationValue.toFixed(2)} / {row.deviationRate.toFixed(1)}%
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "상태 / 판정",
      className: "w-40",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {renderStatusPill(row.status)}
            {renderResultPill(row.result)}
            {renderNcrPill(row.ncrStatus)}
          </div>
          <div className="text-xs text-foreground-muted">Rev.{row.versionNo}</div>
        </div>
      ),
    },
    {
      key: "testingAgency",
      header: "기관 / 첨부",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-sm text-foreground">{row.testingAgency || "-"}</div>
          <div className="text-xs text-foreground-muted">{row.certificateNo || "성적서 번호 미입력"}</div>
          <div className="text-xs text-foreground-muted">첨부 {row.attachments.length}건</div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "작업",
      className: "w-40",
      render: (_value, row) =>
        canManage ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
              onClick={(event) => {
                event.stopPropagation();
                void openEditForm(row._id);
              }}
            >
              수정
            </button>
            <button
              type="button"
              className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteTarget({
                  _id: row._id,
                  sampleName: row.sampleName,
                  testDate: row.testDate,
                });
              }}
            >
              삭제
            </button>
          </div>
        ) : (
          <span className="text-xs text-foreground-muted">조회</span>
        ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">시험 성적서</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            시험 결과, 기준치 이탈, 첨부 성적서, NCR 연계 포인트를 함께 관리합니다.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => void openCreateForm()}
            className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUserLoading}
          >
            시험 성적서 등록
          </button>
        ) : null}
      </div>

      <QcFeedbackBanners message={message} error={error ?? memberError} />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-foreground-muted">현재 목록</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{items.length}</p>
          <p className="mt-1 text-xs text-foreground-muted">페이지 기준 시험 성적서 건수</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-amber-700">검토 요청</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{pendingReviewCount}</p>
          <p className="mt-1 text-xs text-amber-700/80">검토가 필요한 제출 상태</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-rose-700">기준치 이탈 / NCR 검토</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">
            {failingCount} / {ncrRecommendedCount}
          </p>
          <p className="mt-1 text-xs text-rose-700/80">부적합 건수 / NCR 검토 필요 건수</p>
        </div>
      </div>

      <QcFilterPanel
        description="시료명, 성적서 번호, 시험 기관, 참조 검사, NCR 참조로 검색하고 상태별로 조회할 수 있습니다."
        actions={
          <>
            <button
              type="button"
              onClick={() => startTransition(() => setPage(1))}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background-soft"
            >
              조회
            </button>
            <button
              type="button"
              onClick={() => {
                setKeyword("");
                setStatusFilter("all");
                setResultFilter("all");
                setSourceFilter("all");
                setSortBy("test_date_desc");
                startTransition(() => setPage(1));
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-background-soft"
            >
              초기화
            </button>
          </>
        }
        footer={
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <QcSortSelect
              compact
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={(value) => {
                setSortBy(value as QcTestReportSort);
                startTransition(() => setPage(1));
              }}
            />
            <p className="text-xs text-foreground-muted">
              현재 {items.length}건 표시 / 페이지 {page} / 총 {totalPages}페이지
            </p>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <FormInput
            label="검색어"
            placeholder="시료명, 성적서 번호, 시험 기관"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              startTransition(() => setPage(1));
            }}
          />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">상태</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "all" | QcTestReportStatus);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_TEST_REPORT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">판정</span>
            <select
              value={resultFilter}
              onChange={(event) => {
                setResultFilter(event.target.value as "all" | QcTestReportResult);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_TEST_REPORT_RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">출처</span>
            <select
              value={sourceFilter}
              onChange={(event) => {
                setSourceFilter(event.target.value as "all" | QcTestReportSourceType);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_TEST_REPORT_SOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </QcFilterPanel>

      {showForm ? (
        <section className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {editingId ? "시험 성적서 수정" : "시험 성적서 등록"}
              </h2>
              <p className="text-sm text-foreground-muted">
                시료 정보, 기준값/실측값, 성적서 파일, 검토/승인 상태를 함께 관리합니다.
              </p>
            </div>
            <div className="text-xs text-foreground-muted">
              {isFormLoading ? "수정 정보를 불러오는 중..." : isUploading ? "첨부 업로드 중..." : null}
            </div>
          </div>

          <div className="mt-4 space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">시험 구분</span>
                <select
                  value={form.testType}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, testType: event.target.value as QcTestReportType }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  {QC_TEST_REPORT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">출처</span>
                <select
                  value={form.sourceType}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      sourceType: event.target.value as QcTestReportSourceType,
                      linkedMaterialInspectionId:
                        event.target.value === "material_inspection" ? previous.linkedMaterialInspectionId : "",
                      linkedProcessInspectionId:
                        event.target.value === "process_inspection" ? previous.linkedProcessInspectionId : "",
                    }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  {QC_TEST_REPORT_SOURCE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-border bg-background-soft px-3 py-2">
                <p className="text-xs font-medium text-foreground-muted">작성자</p>
                <p className="mt-1 text-sm text-foreground">{user.userName || "-"}</p>
              </div>

              {form.sourceType === "material_inspection" ? (
                <label className="space-y-1 md:col-span-3">
                  <span className="block text-sm font-medium text-foreground">참조 자재 검사</span>
                  <select
                    value={form.linkedMaterialInspectionId}
                    onChange={(event) => {
                      const selected = materialOptions.find((option) => option._id === event.target.value);
                      setForm((previous) => ({
                        ...previous,
                        linkedMaterialInspectionId: event.target.value,
                        linkedProcessInspectionId: "",
                        sampleName: previous.sampleName || selected?.materialName || "",
                        samplingDate: previous.samplingDate || formatDate(selected?.inspectionDate),
                      }));
                    }}
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    <option value="">선택 안 함</option>
                    {materialOptions.map((option) => (
                      <option key={option._id} value={option._id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {form.sourceType === "process_inspection" ? (
                <label className="space-y-1 md:col-span-3">
                  <span className="block text-sm font-medium text-foreground">참조 공정 검사</span>
                  <select
                    value={form.linkedProcessInspectionId}
                    onChange={(event) => {
                      const selected = processOptions.find((option) => option._id === event.target.value);
                      setForm((previous) => ({
                        ...previous,
                        linkedProcessInspectionId: event.target.value,
                        linkedMaterialInspectionId: "",
                        sampleName: previous.sampleName || selected?.inspectionTitle || "",
                        samplingLocation: previous.samplingLocation || selected?.location || "",
                      }));
                    }}
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    <option value="">선택 안 함</option>
                    {processOptions.map((option) => (
                      <option key={option._id} value={option._id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <FormInput
                label="시료명"
                value={form.sampleName}
                onChange={(event) => setForm((previous) => ({ ...previous, sampleName: event.target.value }))}
              />
              <FormInput
                label="시료 번호"
                value={form.specimenNo}
                onChange={(event) => setForm((previous) => ({ ...previous, specimenNo: event.target.value }))}
              />
              <FormInput
                label="채취 위치"
                value={form.samplingLocation}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, samplingLocation: event.target.value }))
                }
              />
              <FormInput
                label="채취일"
                type="date"
                value={form.samplingDate}
                onChange={(event) => setForm((previous) => ({ ...previous, samplingDate: event.target.value }))}
              />
              <FormInput
                label="시험일"
                type="date"
                value={form.testDate}
                onChange={(event) => setForm((previous) => ({ ...previous, testDate: event.target.value }))}
              />
              <FormInput
                label="시험 기관"
                value={form.testingAgency}
                onChange={(event) => setForm((previous) => ({ ...previous, testingAgency: event.target.value }))}
              />
              <FormInput
                label="성적서 번호"
                value={form.certificateNo}
                onChange={(event) => setForm((previous) => ({ ...previous, certificateNo: event.target.value }))}
              />
              <FormInput
                label="버전"
                type="number"
                min="1"
                value={form.versionNo}
                onChange={(event) => setForm((previous) => ({ ...previous, versionNo: event.target.value }))}
              />
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">상태</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, status: event.target.value as QcTestReportStatus }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  {QC_TEST_REPORT_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">기준값 / 실측값</h3>
                  <p className="text-xs text-foreground-muted">판정 규칙에 따라 기준치 이탈을 자동 계산합니다.</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {renderResultPill(formEvaluation.result)}
                  {renderNcrPill(form.ncrStatus === "none" && formEvaluation.result === "fail" ? "recommended" : form.ncrStatus)}
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <FormInput
                  label="기준값"
                  type="number"
                  value={form.standardValue}
                  onChange={(event) => setForm((previous) => ({ ...previous, standardValue: event.target.value }))}
                />
                <FormInput
                  label="실측값"
                  type="number"
                  value={form.measuredValue}
                  onChange={(event) => setForm((previous) => ({ ...previous, measuredValue: event.target.value }))}
                />
                <FormInput
                  label="허용 오차"
                  type="number"
                  value={form.toleranceValue}
                  onChange={(event) => setForm((previous) => ({ ...previous, toleranceValue: event.target.value }))}
                />
                <FormInput
                  label="단위"
                  value={form.unit}
                  onChange={(event) => setForm((previous) => ({ ...previous, unit: event.target.value }))}
                  placeholder="MPa, %, mm"
                />
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">판정 규칙</span>
                  <select
                    value={form.judgementRule}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        judgementRule: event.target.value as QcTestReportJudgementRule,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    {QC_TEST_REPORT_JUDGEMENT_RULE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-lg border border-border bg-background-card px-3 py-2">
                  <p className="text-xs font-medium text-foreground-muted">자동 판정</p>
                  <p className="mt-1 text-sm text-foreground">{QC_TEST_REPORT_RESULT_LABELS[formEvaluation.result]}</p>
                </div>
                <div className="rounded-lg border border-border bg-background-card px-3 py-2">
                  <p className="text-xs font-medium text-foreground-muted">편차</p>
                  <p className="mt-1 text-sm text-foreground">{formEvaluation.deviationValue.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-border bg-background-card px-3 py-2">
                  <p className="text-xs font-medium text-foreground-muted">이탈률</p>
                  <p className="mt-1 text-sm text-foreground">{formEvaluation.deviationRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(["reviewer", "approver"] as const).map((target) => {
                const label = target === "reviewer" ? "검토자" : "승인자";
                const memberId = target === "reviewer" ? form.reviewerMemberId : form.approverMemberId;
                const memberName = target === "reviewer" ? form.reviewerName : form.approverName;
                const selectedMember = findMemberById(memberOptions, memberId);

                return (
                  <div key={target} className="space-y-2 rounded-lg border border-border bg-background-soft p-3">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-sm text-foreground-muted">
                      {formatSiteMemberSummary(selectedMember, memberName) || "미지정"}
                    </p>
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

            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">시험 결과 메모</span>
              <textarea
                value={form.summary}
                onChange={(event) => setForm((previous) => ({ ...previous, summary: event.target.value }))}
                className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                placeholder="시험 결과 요약, 특이사항, 현장 전달 메모"
              />
            </label>

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">성적서 첨부</h3>
                  <p className="text-xs text-foreground-muted">시험 성적서 원본, 보고서, 사진을 다건 첨부합니다.</p>
                </div>
                <label className="space-y-1 md:w-48">
                  <span className="block text-xs font-medium text-foreground-muted">업로드 구분</span>
                  <select
                    value={uploadCategory}
                    onChange={(event) => setUploadCategory(event.target.value as QcAttachmentCategory)}
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    {QC_TEST_REPORT_ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
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
                  label="성적서 첨부"
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
                            {QC_TEST_REPORT_ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
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

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">NCR 연계</h3>
                  <p className="text-xs text-foreground-muted">기준치 이탈 시험 결과는 NCR 검토 상태와 참조 번호를 남깁니다.</p>
                </div>
                <Link href="/qc/nonconformance" className="text-xs font-medium text-sky-700 hover:underline">
                  NCR 화면 열기
                </Link>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">NCR 상태</span>
                  <select
                    value={form.ncrStatus}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        ncrStatus: event.target.value as QcTestReportNcrStatus,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    {QC_TEST_REPORT_NCR_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <FormInput
                  label="NCR 참조"
                  value={form.ncrReference}
                  onChange={(event) => setForm((previous) => ({ ...previous, ncrReference: event.target.value }))}
                  placeholder="예: NCR-20260312-002"
                />
                <FormInput
                  label="이력 메모"
                  value={form.historyNote}
                  onChange={(event) => setForm((previous) => ({ ...previous, historyNote: event.target.value }))}
                  placeholder="검토 요청, 승인, 버전 변경 메모"
                />
              </div>
            </div>
          </div>

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
        emptyMessage={isLoading ? "시험 성적서 목록을 불러오는 중입니다." : "등록된 시험 성적서가 없습니다."}
        onRowClick={(row) => {
          void openDetail(row._id);
        }}
        getRowAriaLabel={(row) => `${row.sampleName} 상세 열기`}
      />

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal
        open={Boolean(selectedItem) || isDetailLoading}
        title={selectedItem ? `${selectedItem.sampleName} 상세` : "시험 성적서 상세"}
        onClose={() => {
          if (!isDetailLoading) {
            setSelectedItem(null);
          }
        }}
      >
        {isDetailLoading ? (
          <div className="py-8 text-center text-sm text-foreground-muted">시험 성적서 상세를 불러오는 중입니다.</div>
        ) : selectedItem ? (
          <div className="space-y-5 text-sm text-foreground">
            <div className="flex flex-wrap gap-1">
              {renderStatusPill(selectedItem.status)}
              {renderResultPill(selectedItem.result)}
              {renderNcrPill(selectedItem.ncrStatus)}
            </div>

            <dl className="grid gap-3 md:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-foreground-muted">시료명</dt>
                <dd className="mt-1 font-medium">{selectedItem.sampleName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">시험 구분</dt>
                <dd className="mt-1">{QC_TEST_REPORT_TYPE_LABELS[selectedItem.testType]}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">시료 번호 / 위치</dt>
                <dd className="mt-1">
                  {selectedItem.specimenNo || "-"} / {selectedItem.samplingLocation || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">채취일 / 시험일</dt>
                <dd className="mt-1">
                  {formatDate(selectedItem.samplingDate)} / {formatDate(selectedItem.testDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">시험 기관 / 성적서 번호</dt>
                <dd className="mt-1">
                  {selectedItem.testingAgency || "-"} / {selectedItem.certificateNo || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">작성 / 검토 / 승인</dt>
                <dd className="mt-1">
                  {selectedItem.reporterName || "-"} / {selectedItem.reviewerName || "-"} / {selectedItem.approverName || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">버전</dt>
                <dd className="mt-1">Rev.{selectedItem.versionNo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">NCR 참조</dt>
                <dd className="mt-1">{selectedItem.ncrReference || "-"}</dd>
              </div>
            </dl>

            <div className="rounded-md border border-border bg-background-soft p-3">
              <p className="text-xs font-medium text-foreground-muted">참조 검사</p>
              <p className="mt-2 text-sm text-foreground">
                {selectedItem.linkedMaterialInspectionTitle ||
                  selectedItem.linkedProcessInspectionTitle ||
                  "직접 등록"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border bg-background-soft p-3">
                <p className="text-xs font-medium text-foreground-muted">기준 / 실측</p>
                <p className="mt-2 text-sm text-foreground">
                  기준 {selectedItem.standardValue} {selectedItem.unit}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  실측 {selectedItem.measuredValue} {selectedItem.unit}
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  규칙 {QC_TEST_REPORT_JUDGEMENT_RULE_LABELS[selectedItem.judgementRule]} / 허용 오차 {selectedItem.toleranceValue}
                </p>
              </div>
              <div className="rounded-md border border-border bg-background-soft p-3">
                <p className="text-xs font-medium text-foreground-muted">이탈 정보</p>
                <p className="mt-2 text-sm text-foreground">편차 {selectedItem.deviationValue.toFixed(2)}</p>
                <p className="mt-1 text-sm text-foreground">이탈률 {selectedItem.deviationRate.toFixed(1)}%</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">시험 결과 메모</p>
              <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-background-soft px-3 py-2">
                {selectedItem.summary || "-"}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground-muted">첨부 파일</p>
                <Link href="/qc/nonconformance" className="text-xs font-medium text-sky-700 hover:underline">
                  NCR 화면 열기
                </Link>
              </div>
              <div className="mt-2 space-y-2">
                {selectedItem.attachments.length > 0 ? (
                  selectedItem.attachments.map((attachment) => (
                    <div
                      key={attachment.fileAssetId}
                      className="flex flex-col gap-2 rounded-md border border-border bg-background-soft px-3 py-2 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <div className="font-medium text-foreground">{attachment.fileName}</div>
                        <div className="text-xs text-foreground-muted">
                          {QC_ATTACHMENT_CATEGORY_LABELS[attachment.category]}
                        </div>
                      </div>
                      {attachment.fileUrl ? (
                        <a
                          href={attachment.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-sky-700 hover:underline"
                        >
                          첨부 열기
                        </a>
                      ) : (
                        <span className="text-sm text-foreground-muted">링크 없음</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-foreground-muted">
                    등록된 첨부가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">이력</p>
              <div className="mt-2 space-y-2">
                {selectedItem.history.length > 0 ? (
                  selectedItem.history
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <div
                        key={`${entry.actionDate}-${entry.actionType}-${index}`}
                        className="rounded-md border border-border bg-background-soft px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
                          <span>{QC_TEST_REPORT_HISTORY_ACTION_LABELS[entry.actionType as QcTestReportHistoryAction]}</span>
                          <span>{formatDateTime(entry.actionDate)}</span>
                          <span>{entry.actorName || "-"}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {renderStatusPill(entry.status)}
                          {renderResultPill(entry.result)}
                          <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            Rev.{entry.versionNo}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{entry.note || "-"}</p>
                      </div>
                    ))
                ) : (
                  <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-foreground-muted">
                    기록된 이력이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="시험 성적서 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4 text-sm text-foreground">
            <p>
              <strong>{deleteTarget.sampleName}</strong> 시험 성적서를 삭제합니다.
            </p>
            <p className="text-foreground-muted">시험일: {formatDate(deleteTarget.testDate)}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-4 py-1.5 text-sm text-foreground hover:bg-background-soft"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
              >
                취소
              </button>
              <button
                type="button"
                className="rounded-md border border-rose-200 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handleDelete()}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={memberPickerTarget !== null}
        title={memberPickerTarget === "approver" ? "승인자 선택" : "검토자 선택"}
        onClose={() => setMemberPickerTarget(null)}
      >
        <div className="space-y-3">
          <FormInput
            label="현장 인력 검색"
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder="이름, 이메일, 권한"
          />
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
            {isMemberLoading ? (
              <p className="p-4 text-sm text-foreground-muted">현장 인력을 불러오는 중입니다.</p>
            ) : filteredMembers.length ? (
              filteredMembers.map((member) => (
                <button
                  key={member._id}
                  type="button"
                  onClick={() => applyMember(member)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left text-sm text-foreground transition hover:bg-background-soft last:border-b-0"
                >
                  <span>
                    <span className="block font-medium">{member.name}</span>
                    <span className="block text-xs text-foreground-muted">
                      {member.email || member.membershipRole}
                    </span>
                  </span>
                  <span className="text-xs text-foreground-muted">{member.role}</span>
                </button>
              ))
            ) : (
              <p className="p-4 text-sm text-foreground-muted">선택 가능한 현장 인력이 없습니다.</p>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
