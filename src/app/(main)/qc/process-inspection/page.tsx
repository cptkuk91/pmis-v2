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
  QC_PROCESS_INSPECTION_ATTACHMENT_CATEGORY_OPTIONS,
  QC_PROCESS_INSPECTION_CHECK_STATUS_LABELS,
  QC_PROCESS_INSPECTION_CHECK_STATUS_OPTIONS,
  QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_LABELS,
  QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_OPTIONS,
  QC_PROCESS_INSPECTION_HISTORY_ACTION_LABELS,
  QC_PROCESS_INSPECTION_ISSUE_STATUS_LABELS,
  QC_PROCESS_INSPECTION_ISSUE_STATUS_OPTIONS,
  QC_PROCESS_INSPECTION_RESULT_LABELS,
  QC_PROCESS_INSPECTION_RESULT_OPTIONS,
  QC_PROCESS_INSPECTION_SORT_LABELS,
  QC_PROCESS_INSPECTION_SORT_VALUES,
  QC_PROCESS_INSPECTION_STATUS_LABELS,
  QC_PROCESS_INSPECTION_STATUS_OPTIONS,
  type QcProcessInspectionAttachment,
  type QcProcessInspectionChecklistItem,
  type QcProcessInspectionCorrectiveActionStatus,
  type QcProcessInspectionHistoryAction,
  type QcProcessInspectionHistoryEntry,
  type QcProcessInspectionIssueStatus,
  type QcProcessInspectionResult,
  type QcProcessInspectionSort,
  type QcProcessInspectionStatus,
} from "@/lib/qc-process-inspections";

type WorkTypeOption = {
  id: string;
  code: string;
  name: string;
  description: string;
};

type ItpOption = {
  _id: string;
  planTitle: string;
  workType: string;
  processStep: string;
  year: number;
  versionNo: number;
  status: string;
};

type ItpCheckpoint = {
  checkpointId: string;
  checkpointTitle: string;
  phaseName: string;
  acceptanceCriteria: string;
};

type ProcessInspectionRow = {
  _id: string;
  workType: string;
  location: string;
  processStep: string;
  inspectionTitle: string;
  plannedInspectionDate: string;
  actualInspectionDate: string;
  status: QcProcessInspectionStatus;
  result: QcProcessInspectionResult;
  requesterName: string;
  requesterMemberId: string;
  inspectorName: string;
  inspectorMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  linkedItpPlanId: string;
  linkedItpPlanTitle: string;
  linkedItpCheckpointId: string;
  linkedItpCheckpointTitle: string;
  acceptanceCriteria: string;
  checklistItems: QcProcessInspectionChecklistItem[];
  inspectionNotes: string;
  correctiveActionStatus: QcProcessInspectionCorrectiveActionStatus;
  correctiveActionRequest: string;
  correctiveActionDueDate: string;
  correctiveActionSummary: string;
  attachments: QcProcessInspectionAttachment[];
  issueStatus: QcProcessInspectionIssueStatus;
  issueReference: string;
  history: QcProcessInspectionHistoryEntry[];
  updatedAt?: string;
  actions?: string;
};

type ProcessInspectionForm = {
  workType: string;
  location: string;
  processStep: string;
  inspectionTitle: string;
  plannedInspectionDate: string;
  actualInspectionDate: string;
  status: QcProcessInspectionStatus;
  result: QcProcessInspectionResult;
  requesterName: string;
  requesterMemberId: string;
  inspectorName: string;
  inspectorMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  linkedItpPlanId: string;
  linkedItpCheckpointId: string;
  acceptanceCriteria: string;
  checklistItems: QcProcessInspectionChecklistItem[];
  inspectionNotes: string;
  correctiveActionStatus: QcProcessInspectionCorrectiveActionStatus;
  correctiveActionRequest: string;
  correctiveActionDueDate: string;
  correctiveActionSummary: string;
  attachments: QcProcessInspectionAttachment[];
  issueStatus: QcProcessInspectionIssueStatus;
  issueReference: string;
  historyNote: string;
};

type ProcessInspectionResponse = {
  ok: boolean;
  data: ProcessInspectionRow[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type ProcessInspectionDetailResponse = {
  ok: boolean;
  data?: ProcessInspectionRow;
  error?: string;
};

type ProcessInspectionOptionsResponse = {
  ok: boolean;
  data?: {
    workTypeOptions?: WorkTypeOption[];
    itpOptions?: ItpOption[];
  };
  error?: string;
};

type ItpDetailResponse = {
  ok: boolean;
  data?: { checkpoints?: ItpCheckpoint[] };
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

type DeleteTarget = Pick<ProcessInspectionRow, "_id" | "inspectionTitle" | "plannedInspectionDate">;
type MemberPickerTarget = "requester" | "inspector" | "verifier" | null;

const SITE_ID_KEY = "pmis:siteId";
const SORT_OPTIONS = QC_PROCESS_INSPECTION_SORT_VALUES.map((value) => ({
  value,
  label: QC_PROCESS_INSPECTION_SORT_LABELS[value],
}));

function createChecklistDraft(label = ""): QcProcessInspectionChecklistItem {
  const itemId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `qc-process-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    itemId,
    label,
    status: "pending",
    note: "",
  };
}

function createEmptyForm(defaultRequester = ""): ProcessInspectionForm {
  return {
    workType: "",
    location: "",
    processStep: "",
    inspectionTitle: "",
    plannedInspectionDate: "",
    actualInspectionDate: "",
    status: "scheduled",
    result: "pending",
    requesterName: defaultRequester,
    requesterMemberId: "",
    inspectorName: "",
    inspectorMemberId: "",
    verifierName: "",
    verifierMemberId: "",
    linkedItpPlanId: "",
    linkedItpCheckpointId: "",
    acceptanceCriteria: "",
    checklistItems: [createChecklistDraft()],
    inspectionNotes: "",
    correctiveActionStatus: "none",
    correctiveActionRequest: "",
    correctiveActionDueDate: "",
    correctiveActionSummary: "",
    attachments: [],
    issueStatus: "none",
    issueReference: "",
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

function renderStatusPill(status: QcProcessInspectionStatus) {
  const toneClass =
    status === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "corrective_action_required"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : status === "in_progress"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_PROCESS_INSPECTION_STATUS_LABELS[status]}
    </span>
  );
}

function renderResultPill(result: QcProcessInspectionResult) {
  const toneClass =
    result === "pass"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : result === "fail"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : result === "reinspection"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_PROCESS_INSPECTION_RESULT_LABELS[result]}
    </span>
  );
}

function renderCorrectiveActionPill(status: QcProcessInspectionCorrectiveActionStatus) {
  const toneClass =
    status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "requested"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : status === "in_progress"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_LABELS[status]}
    </span>
  );
}

function renderIssuePill(status: QcProcessInspectionIssueStatus) {
  const toneClass =
    status === "linked"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : status === "recommended"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_PROCESS_INSPECTION_ISSUE_STATUS_LABELS[status]}
    </span>
  );
}

function mapDetailToForm(item: ProcessInspectionRow): ProcessInspectionForm {
  return {
    workType: item.workType ?? "",
    location: item.location ?? "",
    processStep: item.processStep ?? "",
    inspectionTitle: item.inspectionTitle ?? "",
    plannedInspectionDate: formatDate(item.plannedInspectionDate),
    actualInspectionDate: formatDate(item.actualInspectionDate),
    status: item.status ?? "scheduled",
    result: item.result ?? "pending",
    requesterName: item.requesterName ?? "",
    requesterMemberId: item.requesterMemberId ?? "",
    inspectorName: item.inspectorName ?? "",
    inspectorMemberId: item.inspectorMemberId ?? "",
    verifierName: item.verifierName ?? "",
    verifierMemberId: item.verifierMemberId ?? "",
    linkedItpPlanId: item.linkedItpPlanId ?? "",
    linkedItpCheckpointId: item.linkedItpCheckpointId ?? "",
    acceptanceCriteria: item.acceptanceCriteria ?? "",
    checklistItems:
      item.checklistItems?.length > 0
        ? item.checklistItems.map((checkItem) => ({
            itemId: checkItem.itemId,
            label: checkItem.label,
            status: checkItem.status,
            note: checkItem.note,
          }))
        : [createChecklistDraft()],
    inspectionNotes: item.inspectionNotes ?? "",
    correctiveActionStatus: item.correctiveActionStatus ?? "none",
    correctiveActionRequest: item.correctiveActionRequest ?? "",
    correctiveActionDueDate: formatDate(item.correctiveActionDueDate),
    correctiveActionSummary: item.correctiveActionSummary ?? "",
    attachments:
      item.attachments?.map((attachment, index) => ({
        fileAssetId: attachment.fileAssetId,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        category: attachment.category,
        sortOrder: Number(attachment.sortOrder ?? index),
      })) ?? [],
    issueStatus: item.issueStatus ?? "none",
    issueReference: item.issueReference ?? "",
    historyNote: "",
  };
}

function findMemberById(options: SiteMemberOption[], memberId: string) {
  return options.find((option) => option._id === memberId) ?? null;
}

export default function QcProcessInspectionPage() {
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

  const [items, setItems] = useState<ProcessInspectionRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const [statusFilter, setStatusFilter] = useState<"all" | QcProcessInspectionStatus>("all");
  const [correctiveActionFilter, setCorrectiveActionFilter] = useState<"all" | QcProcessInspectionCorrectiveActionStatus>(
    "all",
  );
  const [onlyOpenActions, setOnlyOpenActions] = useState(false);
  const [sortBy, setSortBy] = useState<QcProcessInspectionSort>("planned_date_desc");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProcessInspectionForm>(() => createEmptyForm());
  const [selectedItem, setSelectedItem] = useState<ProcessInspectionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [workTypeOptions, setWorkTypeOptions] = useState<WorkTypeOption[]>([]);
  const [itpOptions, setItpOptions] = useState<ItpOption[]>([]);
  const [checkpoints, setCheckpoints] = useState<ItpCheckpoint[]>([]);
  const [memberPickerTarget, setMemberPickerTarget] = useState<MemberPickerTarget>(null);
  const [uploadCategory, setUploadCategory] = useState<QcAttachmentCategory>("photo");
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          onlyOpenActions: String(onlyOpenActions),
        });

        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (correctiveActionFilter !== "all") {
          params.set("correctiveActionStatus", correctiveActionFilter);
        }

        const response = await fetch(`/api/qc/process-inspections?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as ProcessInspectionResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "공정 검사 목록 조회 실패");
        }

        if (!cancelled) {
          setItems(Array.isArray(result.data) ? result.data : []);
          setPage(result.meta?.page ?? page);
          setTotalPages(result.meta?.totalPages ?? 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "공정 검사 목록 조회 실패");
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
  }, [page, deferredKeyword, sortBy, statusFilter, correctiveActionFilter, onlyOpenActions]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const siteId = readSiteId();
      if (!siteId) {
        if (!cancelled) {
          setWorkTypeOptions([]);
          setItpOptions([]);
        }
        return;
      }

      try {
        const response = await fetch(`/api/qc/process-inspections/options?siteId=${siteId}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as ProcessInspectionOptionsResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "공정 검사 옵션 조회 실패");
        }

        if (!cancelled) {
          setWorkTypeOptions(Array.isArray(result.data?.workTypeOptions) ? result.data?.workTypeOptions : []);
          setItpOptions(Array.isArray(result.data?.itpOptions) ? result.data?.itpOptions : []);
        }
      } catch (err) {
        if (!cancelled) {
          setWorkTypeOptions([]);
          setItpOptions([]);
          setError(err instanceof Error ? err.message : "공정 검사 옵션 조회 실패");
        }
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadItpCheckpoints(planId: string) {
    if (!planId) {
      setCheckpoints([]);
      return [];
    }

    const response = await fetch(`/api/qc/itp/${planId}`, { cache: "no-store" });
    const result = (await response.json()) as ItpDetailResponse;
    if (!result.ok || !result.data) {
      throw new Error(result.error ?? "ITP 체크포인트 조회 실패");
    }

    const nextCheckpoints = result.data.checkpoints ?? [];
    setCheckpoints(nextCheckpoints);
    return nextCheckpoints;
  }

  async function fetchInspectionDetail(inspectionId: string) {
    const response = await fetch(`/api/qc/process-inspections/${inspectionId}`, { cache: "no-store" });
    const result = (await response.json()) as ProcessInspectionDetailResponse;
    if (!result.ok || !result.data) {
      throw new Error(result.error ?? "공정 검사 상세 조회 실패");
    }
    return result.data;
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm(user.userName ?? ""));
    setCheckpoints([]);
    setMemberPickerTarget(null);
    setMemberQuery("");
    setUploadCategory("photo");
    setUploadInputKey((previous) => previous + 1);
  }

  async function openCreateForm() {
    resetForm();
    setShowForm(true);
    setMessage(null);
    setError(null);
  }

  async function openEditForm(inspectionId: string) {
    setShowForm(true);
    setIsFormLoading(true);
    setEditingId(inspectionId);
    setMessage(null);
    setError(null);

    try {
      const detail = await fetchInspectionDetail(inspectionId);
      setForm(mapDetailToForm(detail));
      if (detail.linkedItpPlanId) {
        await loadItpCheckpoints(detail.linkedItpPlanId);
      } else {
        setCheckpoints([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "공정 검사 편집 정보 조회 실패");
    } finally {
      setIsFormLoading(false);
    }
  }

  async function openDetail(inspectionId: string) {
    setIsDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchInspectionDetail(inspectionId);
      setSelectedItem(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "공정 검사 상세 조회 실패");
    } finally {
      setIsDetailLoading(false);
    }
  }

  function updateChecklistItem(
    itemId: string,
    field: keyof QcProcessInspectionChecklistItem,
    value: string,
  ) {
    setForm((previous) => ({
      ...previous,
      checklistItems: previous.checklistItems.map((item) =>
        item.itemId === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    }));
  }

  function addChecklistItem() {
    setForm((previous) => ({
      ...previous,
      checklistItems: [...previous.checklistItems, createChecklistDraft()],
    }));
  }

  function removeChecklistItem(itemId: string) {
    setForm((previous) => ({
      ...previous,
      checklistItems:
        previous.checklistItems.length > 1
          ? previous.checklistItems.filter((item) => item.itemId !== itemId)
          : [createChecklistDraft()],
    }));
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
      const uploadedAttachments: QcProcessInspectionAttachment[] = [];

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

    setForm((previous) => {
      if (memberPickerTarget === "requester") {
        return {
          ...previous,
          requesterName: member.name,
          requesterMemberId: member._id,
        };
      }
      if (memberPickerTarget === "inspector") {
        return {
          ...previous,
          inspectorName: member.name,
          inspectorMemberId: member._id,
        };
      }
      return {
        ...previous,
        verifierName: member.name,
        verifierMemberId: member._id,
      };
    });
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
      const response = await fetch(
        editingId ? `/api/qc/process-inspections/${editingId}` : "/api/qc/process-inspections",
        {
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
        },
      );
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "공정 검사 저장 실패");
      }

      setShowForm(false);
      resetForm();
      setMessage(editingId ? "공정 검사 기록을 수정했습니다." : "공정 검사 기록을 등록했습니다.");
      startTransition(() => setPage(1));
      const siteIdForReload = readSiteId();
      if (siteIdForReload) {
        const params = new URLSearchParams({
          siteId: siteIdForReload,
          page: "1",
          limit: "10",
          q: deferredKeyword,
          sort: sortBy,
          onlyOpenActions: String(onlyOpenActions),
        });
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (correctiveActionFilter !== "all") {
          params.set("correctiveActionStatus", correctiveActionFilter);
        }
        const reloadResponse = await fetch(`/api/qc/process-inspections?${params.toString()}`, { cache: "no-store" });
        const reloadResult = (await reloadResponse.json()) as ProcessInspectionResponse;
        if (reloadResult.ok) {
          setItems(Array.isArray(reloadResult.data) ? reloadResult.data : []);
          setTotalPages(reloadResult.meta?.totalPages ?? 1);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "공정 검사 저장 실패");
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
      const response = await fetch(`/api/qc/process-inspections/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "공정 검사 삭제 실패");
      }

      setDeleteTarget(null);
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
      setMessage("공정 검사 기록을 삭제했습니다.");
      setItems((previous) => previous.filter((item) => item._id !== deleteTarget._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "공정 검사 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const openCorrectiveActionCount = items.filter((item) =>
    item.correctiveActionStatus === "requested" || item.correctiveActionStatus === "in_progress",
  ).length;
  const issueRecommendedCount = items.filter((item) => item.issueStatus === "recommended").length;

  const columns: DataTableColumn<ProcessInspectionRow>[] = [
    {
      key: "inspectionTitle",
      header: "공정 검사",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="font-medium text-foreground">{row.inspectionTitle}</div>
          <div className="text-xs text-foreground-muted">
            {row.workType} / {row.location}
          </div>
          <div className="text-xs text-foreground-muted">{row.processStep}</div>
        </div>
      ),
    },
    {
      key: "linkedItpPlanTitle",
      header: "ITP 참조",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{row.linkedItpPlanTitle || "ITP 미연결"}</div>
          <div className="text-xs text-foreground-muted">{row.linkedItpCheckpointTitle || "체크포인트 미선택"}</div>
        </div>
      ),
    },
    {
      key: "plannedInspectionDate",
      header: "일정 / 상태",
      className: "w-44",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-sm text-foreground">예정 {formatDate(row.plannedInspectionDate)}</div>
          <div className="text-xs text-foreground-muted">실제 {formatDate(row.actualInspectionDate)}</div>
          <div className="flex flex-wrap gap-1">
            {renderStatusPill(row.status)}
            {renderResultPill(row.result)}
          </div>
        </div>
      ),
    },
    {
      key: "requesterName",
      header: "담당자",
      className: "w-40",
      render: (_value, row) => (
        <div className="space-y-1 text-xs text-foreground-muted">
          <div>요청 {row.requesterName || "-"}</div>
          <div>검사 {row.inspectorName || "-"}</div>
          <div>확인 {row.verifierName || "-"}</div>
        </div>
      ),
    },
    {
      key: "correctiveActionStatus",
      header: "시정조치 / 이슈",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {renderCorrectiveActionPill(row.correctiveActionStatus)}
            {renderIssuePill(row.issueStatus)}
          </div>
          <div className="line-clamp-2 text-xs text-foreground-muted">
            {row.correctiveActionRequest || row.correctiveActionSummary || "-"}
          </div>
          {row.issueReference ? <div className="text-xs text-sky-700">{row.issueReference}</div> : null}
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
                  inspectionTitle: row.inspectionTitle,
                  plannedInspectionDate: row.plannedInspectionDate,
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
          <h1 className="text-xl font-semibold text-foreground">공정 검사</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            시공 단계별 검사 계획, 결과, 시정조치와 이슈 전환 포인트를 함께 관리합니다.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => void openCreateForm()}
            className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUserLoading}
          >
            공정 검사 등록
          </button>
        ) : null}
      </div>

      <QcFeedbackBanners message={message} error={error ?? memberError} />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-foreground-muted">현재 목록</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{items.length}</p>
          <p className="mt-1 text-xs text-foreground-muted">페이지 기준 공정 검사 건수</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-rose-700">미조치 항목</p>
          <p className="mt-2 text-2xl font-semibold text-rose-700">{openCorrectiveActionCount}</p>
          <p className="mt-1 text-xs text-rose-700/80">시정조치 요청 또는 진행중 항목</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-amber-700">이슈 검토 필요</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{issueRecommendedCount}</p>
          <p className="mt-1 text-xs text-amber-700/80">이슈로 전환 검토가 필요한 항목</p>
        </div>
      </div>

      <QcFilterPanel
        description="공종, 위치, 검사 항목, 담당자, 시정조치 요청 내용으로 검색하고 상태별로 조회할 수 있습니다."
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
                setCorrectiveActionFilter("all");
                setOnlyOpenActions(false);
                setSortBy("planned_date_desc");
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
                setSortBy(value as QcProcessInspectionSort);
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
            placeholder="공종, 위치, 검사 항목, 담당자"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              startTransition(() => setPage(1));
            }}
          />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">검사 상태</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "all" | QcProcessInspectionStatus);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_PROCESS_INSPECTION_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">시정조치 상태</span>
            <select
              value={correctiveActionFilter}
              onChange={(event) => {
                setCorrectiveActionFilter(
                  event.target.value as "all" | QcProcessInspectionCorrectiveActionStatus,
                );
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={onlyOpenActions}
              onChange={(event) => {
                setOnlyOpenActions(event.target.checked);
                startTransition(() => setPage(1));
              }}
            />
            <span>미조치 항목만 보기</span>
          </label>
        </div>
      </QcFilterPanel>

      {showForm ? (
        <section className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {editingId ? "공정 검사 수정" : "공정 검사 등록"}
              </h2>
              <p className="text-sm text-foreground-muted">
                공정 위치, 담당자, ITP 기준, 검사 결과와 시정조치 이력을 함께 기록합니다.
              </p>
            </div>
            <div className="text-xs text-foreground-muted">
              {isFormLoading ? "수정 정보를 불러오는 중..." : isUploading ? "첨부 업로드 중..." : null}
            </div>
          </div>

          <div className="mt-4 space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">공종</label>
                <input
                  list="qc-process-work-type-options"
                  value={form.workType}
                  onChange={(event) => setForm((previous) => ({ ...previous, workType: event.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                  placeholder="공종 선택 또는 직접입력"
                />
                <datalist id="qc-process-work-type-options">
                  {workTypeOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.description}
                    </option>
                  ))}
                </datalist>
              </div>
              <FormInput
                label="위치"
                value={form.location}
                onChange={(event) => setForm((previous) => ({ ...previous, location: event.target.value }))}
                placeholder="예: B2 주차장 / 3층 동측"
              />
              <FormInput
                label="공정 단계"
                value={form.processStep}
                onChange={(event) => setForm((previous) => ({ ...previous, processStep: event.target.value }))}
                placeholder="예: 철근 배근 / 거푸집 설치"
              />
              <FormInput
                label="검사 항목명"
                wrapperClassName="md:col-span-3"
                value={form.inspectionTitle}
                onChange={(event) => setForm((previous) => ({ ...previous, inspectionTitle: event.target.value }))}
                placeholder="예: 슬래브 철근 배근 검사"
              />
              <FormInput
                label="검사 예정일"
                type="date"
                value={form.plannedInspectionDate}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, plannedInspectionDate: event.target.value }))
                }
              />
              <FormInput
                label="실제 검사일"
                type="date"
                value={form.actualInspectionDate}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, actualInspectionDate: event.target.value }))
                }
              />
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">검사 상태</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      status: event.target.value as QcProcessInspectionStatus,
                    }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  {QC_PROCESS_INSPECTION_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">검사 결과</span>
                <select
                  value={form.result}
                  onChange={(event) =>
                    setForm((previous) => {
                      const nextResult = event.target.value as QcProcessInspectionResult;
                      return {
                        ...previous,
                        result: nextResult,
                        correctiveActionStatus:
                          nextResult === "fail"
                            ? previous.correctiveActionStatus === "none"
                              ? "requested"
                              : previous.correctiveActionStatus
                            : previous.correctiveActionStatus === "requested" &&
                                !previous.correctiveActionRequest &&
                                !previous.correctiveActionSummary
                              ? "none"
                              : previous.correctiveActionStatus,
                        issueStatus:
                          nextResult === "fail"
                            ? previous.issueStatus === "none"
                              ? "recommended"
                              : previous.issueStatus
                            : previous.issueStatus === "recommended"
                              ? "none"
                              : previous.issueStatus,
                      };
                    })
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  {QC_PROCESS_INSPECTION_RESULT_OPTIONS.map((option) => (
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
                  <h3 className="text-sm font-semibold text-foreground">ITP 참조</h3>
                  <p className="text-xs text-foreground-muted">ITP 체크포인트를 선택하면 판정 기준과 검사 항목 초안을 가져옵니다.</p>
                </div>
                <Link href="/qc/itp" className="text-xs font-medium text-sky-700 hover:underline">
                  ITP 화면 열기
                </Link>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">ITP 계획</span>
                  <select
                    value={form.linkedItpPlanId}
                    onChange={(event) => {
                      const nextPlanId = event.target.value;
                      setForm((previous) => ({
                        ...previous,
                        linkedItpPlanId: nextPlanId,
                        linkedItpCheckpointId: "",
                        acceptanceCriteria: "",
                      }));
                      void loadItpCheckpoints(nextPlanId).catch((err) => {
                        setError(err instanceof Error ? err.message : "ITP 체크포인트 조회 실패");
                      });
                    }}
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    <option value="">선택 안 함</option>
                    {itpOptions.map((option) => (
                      <option key={option._id} value={option._id}>
                        {option.planTitle} / {option.workType} / v{option.versionNo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">체크포인트</span>
                  <select
                    value={form.linkedItpCheckpointId}
                    onChange={(event) => {
                      const nextCheckpointId = event.target.value;
                      const checkpoint = checkpoints.find((item) => item.checkpointId === nextCheckpointId);
                      setForm((previous) => {
                        const shouldReplaceChecklist =
                          previous.checklistItems.length === 1 &&
                          !previous.checklistItems[0].label &&
                          !previous.checklistItems[0].note;

                        return {
                          ...previous,
                          linkedItpCheckpointId: nextCheckpointId,
                          inspectionTitle: previous.inspectionTitle || checkpoint?.checkpointTitle || previous.inspectionTitle,
                          acceptanceCriteria: checkpoint?.acceptanceCriteria || previous.acceptanceCriteria,
                          checklistItems: shouldReplaceChecklist
                            ? [createChecklistDraft(checkpoint?.checkpointTitle || "")]
                            : previous.checklistItems,
                        };
                      });
                    }}
                    disabled={!form.linkedItpPlanId}
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    <option value="">선택 안 함</option>
                    {checkpoints.map((checkpoint) => (
                      <option key={checkpoint.checkpointId} value={checkpoint.checkpointId}>
                        {checkpoint.phaseName} / {checkpoint.checkpointTitle}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="block text-sm font-medium text-foreground">판정 기준</span>
                  <textarea
                    value={form.acceptanceCriteria}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, acceptanceCriteria: event.target.value }))
                    }
                    className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                    placeholder="ITP 기준 또는 현장 판정 기준을 입력"
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {(["requester", "inspector", "verifier"] as const).map((target) => {
                const label = target === "requester" ? "요청자" : target === "inspector" ? "검사자" : "확인자";
                const memberIdField =
                  target === "requester"
                    ? form.requesterMemberId
                    : target === "inspector"
                      ? form.inspectorMemberId
                      : form.verifierMemberId;
                const memberNameField =
                  target === "requester"
                    ? form.requesterName
                    : target === "inspector"
                      ? form.inspectorName
                      : form.verifierName;
                const selectedMember = findMemberById(memberOptions, memberIdField);

                return (
                  <div key={target} className="space-y-2 rounded-lg border border-border bg-background-soft p-3">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-sm text-foreground-muted">
                      {formatSiteMemberSummary(selectedMember, memberNameField) || "미지정"}
                    </p>
                    <button
                      type="button"
                      className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background-card"
                      onClick={() => {
                        setMemberPickerTarget(target);
                        setMemberQuery("");
                      }}
                    >
                      현장 인력 선택
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">검사 체크리스트</h3>
                  <p className="text-xs text-foreground-muted">공정별 검사 항목과 부적합 메모를 기록합니다.</p>
                </div>
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-background-card"
                >
                  항목 추가
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {form.checklistItems.map((item) => (
                  <div
                    key={item.itemId}
                    className="grid gap-3 rounded-md border border-border bg-background-card p-3 md:grid-cols-[minmax(0,1.6fr)_180px_minmax(0,1fr)_auto]"
                  >
                    <FormInput
                      label="항목명"
                      value={item.label}
                      onChange={(event) => updateChecklistItem(item.itemId, "label", event.target.value)}
                      placeholder="예: 수직도 / 레벨 / 마감 상태"
                    />
                    <label className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">판정</span>
                      <select
                        value={item.status}
                        onChange={(event) => updateChecklistItem(item.itemId, "status", event.target.value)}
                        className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                      >
                        {QC_PROCESS_INSPECTION_CHECK_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <FormInput
                      label="메모"
                      value={item.note}
                      onChange={(event) => updateChecklistItem(item.itemId, "note", event.target.value)}
                      placeholder="부적합 또는 보완 메모"
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(item.itemId)}
                        className="h-9 rounded-md border border-rose-200 px-3 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">검사 메모</span>
                <textarea
                  value={form.inspectionNotes}
                  onChange={(event) => setForm((previous) => ({ ...previous, inspectionNotes: event.target.value }))}
                  className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                  placeholder="현장 검사 결과, 보완 필요사항 메모"
                />
              </label>
              <div className="rounded-lg border border-border bg-background-soft p-4">
                <div className="flex flex-col gap-3">
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-foreground">시정조치 상태</span>
                    <select
                      value={form.correctiveActionStatus}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          correctiveActionStatus:
                            event.target.value as QcProcessInspectionCorrectiveActionStatus,
                        }))
                      }
                      className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                    >
                      {QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <FormInput
                    label="시정조치 기한"
                    type="date"
                    value={form.correctiveActionDueDate}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, correctiveActionDueDate: event.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">시정조치 요청</span>
                <textarea
                  value={form.correctiveActionRequest}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, correctiveActionRequest: event.target.value }))
                  }
                  className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                  placeholder="보완 요청 사항과 완료 기준"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">조치 결과</span>
                <textarea
                  value={form.correctiveActionSummary}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, correctiveActionSummary: event.target.value }))
                  }
                  className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                  placeholder="시정조치 완료 내용, 재검 결과"
                />
              </label>
            </div>

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">증빙 첨부</h3>
                  <p className="text-xs text-foreground-muted">검사 사진, 체크시트, 보고서를 다건 첨부합니다.</p>
                </div>
                <label className="space-y-1 md:w-48">
                  <span className="block text-xs font-medium text-foreground-muted">업로드 구분</span>
                  <select
                    value={uploadCategory}
                    onChange={(event) => setUploadCategory(event.target.value as QcAttachmentCategory)}
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    {QC_PROCESS_INSPECTION_ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
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
                            {QC_PROCESS_INSPECTION_ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
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
                  <h3 className="text-sm font-semibold text-foreground">이슈 전환 포인트</h3>
                  <p className="text-xs text-foreground-muted">부적합 공정은 이슈 등록 화면으로 이어질 수 있도록 참조를 남깁니다.</p>
                </div>
                <Link href="/system-admin/common/issues" className="text-xs font-medium text-sky-700 hover:underline">
                  이슈 화면 열기
                </Link>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">이슈 상태</span>
                  <select
                    value={form.issueStatus}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        issueStatus: event.target.value as QcProcessInspectionIssueStatus,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    {QC_PROCESS_INSPECTION_ISSUE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <FormInput
                  label="이슈 참조"
                  value={form.issueReference}
                  onChange={(event) => setForm((previous) => ({ ...previous, issueReference: event.target.value }))}
                  placeholder="예: ISSUE-20260312-003"
                />
                <FormInput
                  label="이력 메모"
                  value={form.historyNote}
                  onChange={(event) => setForm((previous) => ({ ...previous, historyNote: event.target.value }))}
                  placeholder="시정조치 요청, 승인, 재검 메모"
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
        emptyMessage={isLoading ? "공정 검사 목록을 불러오는 중입니다." : "등록된 공정 검사 기록이 없습니다."}
        onRowClick={(row) => {
          void openDetail(row._id);
        }}
        getRowAriaLabel={(row) => `${row.inspectionTitle} 상세 열기`}
      />

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal
        open={Boolean(selectedItem) || isDetailLoading}
        title={selectedItem ? `${selectedItem.inspectionTitle} 상세` : "공정 검사 상세"}
        onClose={() => {
          if (!isDetailLoading) {
            setSelectedItem(null);
          }
        }}
      >
        {isDetailLoading ? (
          <div className="py-8 text-center text-sm text-foreground-muted">공정 검사 상세를 불러오는 중입니다.</div>
        ) : selectedItem ? (
          <div className="space-y-5 text-sm text-foreground">
            <div className="flex flex-wrap gap-1">
              {renderStatusPill(selectedItem.status)}
              {renderResultPill(selectedItem.result)}
              {renderCorrectiveActionPill(selectedItem.correctiveActionStatus)}
              {renderIssuePill(selectedItem.issueStatus)}
            </div>

            <dl className="grid gap-3 md:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-foreground-muted">검사 항목</dt>
                <dd className="mt-1 font-medium">{selectedItem.inspectionTitle}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">공종 / 위치</dt>
                <dd className="mt-1">
                  {selectedItem.workType} / {selectedItem.location}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">공정 단계</dt>
                <dd className="mt-1">{selectedItem.processStep}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">예정일 / 실제일</dt>
                <dd className="mt-1">
                  {formatDate(selectedItem.plannedInspectionDate)} / {formatDate(selectedItem.actualInspectionDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">요청자 / 검사자 / 확인자</dt>
                <dd className="mt-1">
                  {selectedItem.requesterName || "-"} / {selectedItem.inspectorName || "-"} / {selectedItem.verifierName || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">이슈 참조</dt>
                <dd className="mt-1">{selectedItem.issueReference || "-"}</dd>
              </div>
            </dl>

            <div className="rounded-md border border-border bg-background-soft p-3">
              <p className="text-xs font-medium text-foreground-muted">ITP 참조</p>
              <p className="mt-2 font-medium text-foreground">{selectedItem.linkedItpPlanTitle || "ITP 미연결"}</p>
              <p className="mt-1 text-sm text-foreground-muted">{selectedItem.linkedItpCheckpointTitle || "체크포인트 미선택"}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {selectedItem.acceptanceCriteria || "판정 기준 미입력"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border bg-background-soft p-3">
                <p className="text-xs font-medium text-foreground-muted">검사 메모</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{selectedItem.inspectionNotes || "-"}</p>
              </div>
              <div className="rounded-md border border-border bg-background-soft p-3">
                <p className="text-xs font-medium text-foreground-muted">시정조치</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  요청: {selectedItem.correctiveActionRequest || "-"}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  결과: {selectedItem.correctiveActionSummary || "-"}
                </p>
                <p className="mt-2 text-xs text-foreground-muted">
                  기한 {formatDate(selectedItem.correctiveActionDueDate)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">검사 체크리스트</p>
              <div className="mt-2 space-y-2">
                {selectedItem.checklistItems.length > 0 ? (
                  selectedItem.checklistItems.map((item) => (
                    <div
                      key={item.itemId}
                      className="grid gap-2 rounded-md border border-border bg-background-soft px-3 py-2 md:grid-cols-[minmax(0,1.6fr)_140px_minmax(0,1fr)]"
                    >
                      <div className="font-medium text-foreground">{item.label}</div>
                      <div className="text-sm text-foreground-muted">
                        {QC_PROCESS_INSPECTION_CHECK_STATUS_LABELS[item.status]}
                      </div>
                      <div className="text-sm text-foreground">{item.note || "-"}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-foreground-muted">
                    등록된 체크리스트가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground-muted">첨부 파일</p>
                <Link href="/system-admin/common/issues" className="text-xs font-medium text-sky-700 hover:underline">
                  이슈 화면 열기
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
                          <span>{QC_PROCESS_INSPECTION_HISTORY_ACTION_LABELS[entry.actionType as QcProcessInspectionHistoryAction]}</span>
                          <span>{formatDateTime(entry.actionDate)}</span>
                          <span>{entry.actorName || "-"}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {renderStatusPill(entry.status)}
                          {renderCorrectiveActionPill(entry.correctiveActionStatus)}
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
        title="공정 검사 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4 text-sm text-foreground">
            <p>
              <strong>{deleteTarget.inspectionTitle}</strong> 공정 검사 기록을 삭제합니다.
            </p>
            <p className="text-foreground-muted">예정일: {formatDate(deleteTarget.plannedInspectionDate)}</p>
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
        title="담당자 선택"
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
