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
  QC_HANDOVER_APPROVAL_STATUS_LABELS,
  QC_HANDOVER_APPROVAL_STATUS_OPTIONS,
  QC_HANDOVER_AREA_TYPE_LABELS,
  QC_HANDOVER_AREA_TYPE_OPTIONS,
  QC_HANDOVER_ATTACHMENT_CATEGORY_OPTIONS,
  QC_HANDOVER_CHECK_STATUS_LABELS,
  QC_HANDOVER_CHECK_STATUS_OPTIONS,
  QC_HANDOVER_FINDING_STATUS_LABELS,
  QC_HANDOVER_FINDING_STATUS_OPTIONS,
  QC_HANDOVER_HISTORY_ACTION_LABELS,
  QC_HANDOVER_INSPECTION_TYPE_LABELS,
  QC_HANDOVER_INSPECTION_TYPE_OPTIONS,
  QC_HANDOVER_RESULT_LABELS,
  QC_HANDOVER_RESULT_OPTIONS,
  QC_HANDOVER_SORT_LABELS,
  QC_HANDOVER_SORT_VALUES,
  QC_HANDOVER_STATUS_LABELS,
  QC_HANDOVER_STATUS_OPTIONS,
  getQcHandoverOpenFindingCount,
  getQcHandoverResult,
  type QcHandoverApprovalStatus,
  type QcHandoverCheckStatus,
  type QcHandoverHistoryAction,
  type QcHandoverInspectionAttachment,
  type QcHandoverInspectionChecklistItem,
  type QcHandoverInspectionHistoryEntry,
  type QcHandoverInspectionType,
  type QcHandoverResult,
  type QcHandoverSort,
  type QcHandoverStatus,
} from "@/lib/qc-handover-inspections";

type WorkTypeOption = {
  id: string;
  code: string;
  name: string;
  description: string;
};

type ProcessInspectionOption = {
  _id: string;
  inspectionTitle: string;
  workType: string;
  location: string;
  plannedInspectionDate: string;
  status: string;
  result: string;
};

type NcrOption = {
  _id: string;
  ncrNo: string;
  title: string;
  severity: string;
  status: string;
  dueDate: string;
};

type HandoverInspectionRow = {
  _id: string;
  inspectionNo: string;
  inspectionType: QcHandoverInspectionType;
  inspectionTitle: string;
  workType: string;
  areaType: string;
  areaLabel: string;
  unitNo: string;
  zoneName: string;
  plannedInspectionDate: string;
  inspectedAt: string;
  status: QcHandoverStatus;
  result: QcHandoverResult;
  openFindingCount: number;
  requesterName: string;
  requesterMemberId: string;
  inspectorName: string;
  inspectorMemberId: string;
  approverName: string;
  approverMemberId: string;
  approvalStatus: QcHandoverApprovalStatus;
  approvedAt: string;
  approvalComment: string;
  inspectionSummary: string;
  linkedProcessInspectionId: string;
  linkedProcessInspectionTitle: string;
  linkedNcrId: string;
  linkedNcrNo: string;
  linkedNcrTitle: string;
  checklistItems: QcHandoverInspectionChecklistItem[];
  attachments: QcHandoverInspectionAttachment[];
  history: QcHandoverInspectionHistoryEntry[];
  updatedAt?: string;
  actions?: string;
};

type HandoverInspectionForm = {
  inspectionType: QcHandoverInspectionType;
  inspectionTitle: string;
  workType: string;
  areaType: "space" | "unit" | "zone" | "common";
  areaLabel: string;
  unitNo: string;
  zoneName: string;
  plannedInspectionDate: string;
  inspectedAt: string;
  status: QcHandoverStatus;
  requesterName: string;
  requesterMemberId: string;
  inspectorName: string;
  inspectorMemberId: string;
  approverName: string;
  approverMemberId: string;
  approvalStatus: QcHandoverApprovalStatus;
  approvedAt: string;
  approvalComment: string;
  inspectionSummary: string;
  linkedProcessInspectionId: string;
  linkedNcrId: string;
  checklistItems: QcHandoverInspectionChecklistItem[];
  attachments: QcHandoverInspectionAttachment[];
  historyNote: string;
};

type HandoverInspectionResponse = {
  ok: boolean;
  data: HandoverInspectionRow[];
  meta?: {
    page: number;
    totalPages: number;
    total?: number;
    summary?: {
      unresolvedCount?: number;
      approvalRequestedCount?: number;
      closedCount?: number;
    };
  };
  error?: string;
};

type HandoverInspectionDetailResponse = {
  ok: boolean;
  data?: HandoverInspectionRow;
  error?: string;
};

type HandoverInspectionOptionsResponse = {
  ok: boolean;
  data?: {
    workTypeOptions?: WorkTypeOption[];
    processInspectionOptions?: ProcessInspectionOption[];
    ncrOptions?: NcrOption[];
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

type DeleteTarget = Pick<HandoverInspectionRow, "_id" | "inspectionNo" | "inspectionTitle">;
type MemberPickerTarget = "requester" | "inspector" | "approver" | null;

const SITE_ID_KEY = "pmis:siteId";
const SORT_OPTIONS = QC_HANDOVER_SORT_VALUES.map((value) => ({
  value,
  label: QC_HANDOVER_SORT_LABELS[value],
}));

function createChecklistDraft(): QcHandoverInspectionChecklistItem {
  const itemId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `qc-handover-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    itemId,
    sectionTitle: "",
    checkpointTitle: "",
    spaceLabel: "",
    status: "pending",
    note: "",
    findingTitle: "",
    correctiveRequest: "",
    correctiveDueDate: null,
    findingStatus: "none",
    completionNote: "",
  };
}

function createEmptyForm(defaultRequester = ""): HandoverInspectionForm {
  return {
    inspectionType: "acceptance",
    inspectionTitle: "",
    workType: "",
    areaType: "space",
    areaLabel: "",
    unitNo: "",
    zoneName: "",
    plannedInspectionDate: "",
    inspectedAt: "",
    status: "scheduled",
    requesterName: defaultRequester,
    requesterMemberId: "",
    inspectorName: "",
    inspectorMemberId: "",
    approverName: "",
    approverMemberId: "",
    approvalStatus: "none",
    approvedAt: "",
    approvalComment: "",
    inspectionSummary: "",
    linkedProcessInspectionId: "",
    linkedNcrId: "",
    checklistItems: [createChecklistDraft()],
    attachments: [],
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

function buildAreaSummary(input: {
  areaType?: string;
  areaLabel?: string;
  unitNo?: string;
  zoneName?: string;
}) {
  const label = QC_HANDOVER_AREA_TYPE_LABELS[input.areaType as keyof typeof QC_HANDOVER_AREA_TYPE_LABELS] ?? "영역";
  const values = [input.areaLabel, input.unitNo, input.zoneName].map((value) => String(value ?? "").trim()).filter(Boolean);
  if (!values.length) {
    return `${label} 미입력`;
  }
  return `${label} / ${values.join(" / ")}`;
}

function renderStatusPill(status: QcHandoverStatus) {
  const toneClass =
    status === "approved" || status === "closed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "approval_requested"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : status === "follow_up"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_HANDOVER_STATUS_LABELS[status]}
    </span>
  );
}

function renderResultPill(result: QcHandoverResult) {
  const toneClass =
    result === "pass"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : result === "conditional"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : result === "fail"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_HANDOVER_RESULT_LABELS[result]}
    </span>
  );
}

function renderApprovalPill(status: QcHandoverApprovalStatus) {
  const toneClass =
    status === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "requested"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : status === "rejected"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_HANDOVER_APPROVAL_STATUS_LABELS[status]}
    </span>
  );
}

function mapDetailToForm(item: HandoverInspectionRow): HandoverInspectionForm {
  return {
    inspectionType: item.inspectionType ?? "acceptance",
    inspectionTitle: item.inspectionTitle ?? "",
    workType: item.workType ?? "",
    areaType: (item.areaType as HandoverInspectionForm["areaType"]) ?? "space",
    areaLabel: item.areaLabel ?? "",
    unitNo: item.unitNo ?? "",
    zoneName: item.zoneName ?? "",
    plannedInspectionDate: formatDate(item.plannedInspectionDate),
    inspectedAt: formatDate(item.inspectedAt),
    status: item.status ?? "scheduled",
    requesterName: item.requesterName ?? "",
    requesterMemberId: item.requesterMemberId ?? "",
    inspectorName: item.inspectorName ?? "",
    inspectorMemberId: item.inspectorMemberId ?? "",
    approverName: item.approverName ?? "",
    approverMemberId: item.approverMemberId ?? "",
    approvalStatus: item.approvalStatus ?? "none",
    approvedAt: formatDate(item.approvedAt),
    approvalComment: item.approvalComment ?? "",
    inspectionSummary: item.inspectionSummary ?? "",
    linkedProcessInspectionId: item.linkedProcessInspectionId ?? "",
    linkedNcrId: item.linkedNcrId ?? "",
    checklistItems:
      item.checklistItems?.length > 0
        ? item.checklistItems.map((checkItem) => ({
            itemId: checkItem.itemId,
            sectionTitle: checkItem.sectionTitle,
            checkpointTitle: checkItem.checkpointTitle,
            spaceLabel: checkItem.spaceLabel,
            status: checkItem.status,
            note: checkItem.note,
            findingTitle: checkItem.findingTitle,
            correctiveRequest: checkItem.correctiveRequest,
            correctiveDueDate: checkItem.correctiveDueDate ? formatDate(checkItem.correctiveDueDate) : null,
            findingStatus: checkItem.findingStatus,
            completionNote: checkItem.completionNote,
          }))
        : [createChecklistDraft()],
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

export default function QcHandoverInspectionPage() {
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

  const [items, setItems] = useState<HandoverInspectionRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const [inspectionTypeFilter, setInspectionTypeFilter] = useState<"all" | QcHandoverInspectionType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | QcHandoverStatus>("all");
  const [approvalStatusFilter, setApprovalStatusFilter] = useState<"all" | QcHandoverApprovalStatus>("all");
  const [resultFilter, setResultFilter] = useState<"all" | QcHandoverResult>("all");
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<QcHandoverSort>("planned_date_desc");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HandoverInspectionForm>(() => createEmptyForm());
  const [selectedItem, setSelectedItem] = useState<HandoverInspectionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [workTypeOptions, setWorkTypeOptions] = useState<WorkTypeOption[]>([]);
  const [processInspectionOptions, setProcessInspectionOptions] = useState<ProcessInspectionOption[]>([]);
  const [ncrOptions, setNcrOptions] = useState<NcrOption[]>([]);
  const [memberPickerTarget, setMemberPickerTarget] = useState<MemberPickerTarget>(null);
  const [uploadCategory, setUploadCategory] = useState<QcAttachmentCategory>("photo");
  const [uploadInputKey, setUploadInputKey] = useState(0);
  const [unresolvedSummary, setUnresolvedSummary] = useState(0);
  const [approvalRequestedSummary, setApprovalRequestedSummary] = useState(0);
  const [closedSummary, setClosedSummary] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user.userName) {
      return;
    }
    setForm((previous) => {
      if (editingId || previous.requesterName) {
        return previous;
      }
      return {
        ...previous,
        requesterName: user.userName ?? "",
      };
    });
  }, [user.userName, editingId]);

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      const siteId = readSiteId();
      if (!siteId) {
        if (!cancelled) {
          setItems([]);
          setTotalPages(1);
          setTotalCount(0);
          setUnresolvedSummary(0);
          setApprovalRequestedSummary(0);
          setClosedSummary(0);
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
          unresolvedOnly: String(unresolvedOnly),
          sort: sortBy,
        });

        if (inspectionTypeFilter !== "all") {
          params.set("inspectionType", inspectionTypeFilter);
        }
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (approvalStatusFilter !== "all") {
          params.set("approvalStatus", approvalStatusFilter);
        }
        if (resultFilter !== "all") {
          params.set("result", resultFilter);
        }

        const response = await fetch(`/api/qc/handover-inspections?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as HandoverInspectionResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "인수·준공 검사 목록 조회 실패");
        }

        if (!cancelled) {
          setItems(Array.isArray(result.data) ? result.data : []);
          setPage(result.meta?.page ?? page);
          setTotalPages(result.meta?.totalPages ?? 1);
          setTotalCount(result.meta?.total ?? 0);
          setUnresolvedSummary(result.meta?.summary?.unresolvedCount ?? 0);
          setApprovalRequestedSummary(result.meta?.summary?.approvalRequestedCount ?? 0);
          setClosedSummary(result.meta?.summary?.closedCount ?? 0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "인수·준공 검사 목록 조회 실패");
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
  }, [page, deferredKeyword, inspectionTypeFilter, statusFilter, approvalStatusFilter, resultFilter, unresolvedOnly, sortBy]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const siteId = readSiteId();
      if (!siteId) {
        if (!cancelled) {
          setWorkTypeOptions([]);
          setProcessInspectionOptions([]);
          setNcrOptions([]);
        }
        return;
      }

      try {
        const response = await fetch(`/api/qc/handover-inspections/options?siteId=${siteId}`, { cache: "no-store" });
        const result = (await response.json()) as HandoverInspectionOptionsResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "인수·준공 검사 옵션 조회 실패");
        }

        if (!cancelled) {
          setWorkTypeOptions(Array.isArray(result.data?.workTypeOptions) ? result.data?.workTypeOptions : []);
          setProcessInspectionOptions(
            Array.isArray(result.data?.processInspectionOptions) ? result.data?.processInspectionOptions : [],
          );
          setNcrOptions(Array.isArray(result.data?.ncrOptions) ? result.data?.ncrOptions : []);
        }
      } catch (err) {
        if (!cancelled) {
          setWorkTypeOptions([]);
          setProcessInspectionOptions([]);
          setNcrOptions([]);
          setError(err instanceof Error ? err.message : "인수·준공 검사 옵션 조회 실패");
        }
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setForm(createEmptyForm(user.userName ?? ""));
    setEditingId(null);
    setUploadCategory("photo");
    setUploadInputKey((previous) => previous + 1);
    setMemberPickerTarget(null);
    setMemberQuery("");
  }

  async function openDetail(inspectionId: string) {
    setIsDetailLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/qc/handover-inspections/${inspectionId}`, { cache: "no-store" });
      const result = (await response.json()) as HandoverInspectionDetailResponse;
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "인수·준공 검사 상세 조회 실패");
      }
      setSelectedItem(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "인수·준공 검사 상세 조회 실패");
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function openEdit(inspectionId: string) {
    setShowForm(true);
    setIsFormLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/qc/handover-inspections/${inspectionId}`, { cache: "no-store" });
      const result = (await response.json()) as HandoverInspectionDetailResponse;
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "인수·준공 검사 상세 조회 실패");
      }

      setEditingId(inspectionId);
      setForm(mapDetailToForm(result.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "인수·준공 검사 상세 조회 실패");
    } finally {
      setIsFormLoading(false);
    }
  }

  function addChecklistItem() {
    setForm((previous) => ({
      ...previous,
      checklistItems: [...previous.checklistItems, createChecklistDraft()],
    }));
  }

  function updateChecklistItem(
    itemId: string,
    field: keyof QcHandoverInspectionChecklistItem,
    value: string,
  ) {
    setForm((previous) => ({
      ...previous,
      checklistItems: previous.checklistItems.map((item) => {
        if (item.itemId !== itemId) {
          return item;
        }

        const nextItem = { ...item, [field]: value } as QcHandoverInspectionChecklistItem;
        if (field === "status") {
          const nextStatus = value as QcHandoverCheckStatus;
          if ((nextStatus === "fail" || nextStatus === "conditional") && item.findingStatus === "none") {
            nextItem.findingStatus = "requested";
          }
          if (nextStatus === "pass" && !item.findingTitle && !item.correctiveRequest && item.findingStatus === "requested") {
            nextItem.findingStatus = "none";
          }
        }
        return nextItem;
      }),
    }));
  }

  function removeChecklistItem(itemId: string) {
    setForm((previous) => {
      const nextItems = previous.checklistItems.filter((item) => item.itemId !== itemId);
      return {
        ...previous,
        checklistItems: nextItems.length ? nextItems : [createChecklistDraft()],
      };
    });
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
      const uploadedAttachments: QcHandoverInspectionAttachment[] = [];

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
        approverName: member.name,
        approverMemberId: member._id,
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
        editingId ? `/api/qc/handover-inspections/${editingId}` : "/api/qc/handover-inspections",
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
            checklistItems: form.checklistItems.map((item) => ({
              ...item,
              correctiveDueDate: item.correctiveDueDate || null,
            })),
          }),
        },
      );
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "인수·준공 검사 저장 실패");
      }

      setShowForm(false);
      resetForm();
      setMessage(editingId ? "인수·준공 검사 기록을 수정했습니다." : "인수·준공 검사 기록을 등록했습니다.");
      startTransition(() => setPage(1));
      const refreshSiteId = readSiteId();
      if (refreshSiteId) {
        const params = new URLSearchParams({
          siteId: refreshSiteId,
          page: "1",
          limit: "10",
          q: deferredKeyword,
          unresolvedOnly: String(unresolvedOnly),
          sort: sortBy,
        });
        if (inspectionTypeFilter !== "all") params.set("inspectionType", inspectionTypeFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (approvalStatusFilter !== "all") params.set("approvalStatus", approvalStatusFilter);
        if (resultFilter !== "all") params.set("result", resultFilter);
        const listResponse = await fetch(`/api/qc/handover-inspections?${params.toString()}`, { cache: "no-store" });
        const listResult = (await listResponse.json()) as HandoverInspectionResponse;
        if (listResult.ok) {
          setItems(Array.isArray(listResult.data) ? listResult.data : []);
          setTotalPages(listResult.meta?.totalPages ?? 1);
          setTotalCount(listResult.meta?.total ?? 0);
          setUnresolvedSummary(listResult.meta?.summary?.unresolvedCount ?? 0);
          setApprovalRequestedSummary(listResult.meta?.summary?.approvalRequestedCount ?? 0);
          setClosedSummary(listResult.meta?.summary?.closedCount ?? 0);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "인수·준공 검사 저장 실패");
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
    setMessage(null);

    try {
      const response = await fetch(`/api/qc/handover-inspections/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "인수·준공 검사 삭제 실패");
      }

      setDeleteTarget(null);
      setItems((previous) => previous.filter((item) => item._id !== deleteTarget._id));
      setMessage(`${deleteTarget.inspectionNo || deleteTarget.inspectionTitle} 기록을 삭제했습니다.`);
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "인수·준공 검사 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const derivedResult = getQcHandoverResult(form.checklistItems);
  const derivedOpenFindingCount = getQcHandoverOpenFindingCount(form.checklistItems);
  const selectedProcessInspection =
    processInspectionOptions.find((option) => option._id === form.linkedProcessInspectionId) ?? null;
  const selectedNcr = ncrOptions.find((option) => option._id === form.linkedNcrId) ?? null;

  const columns: DataTableColumn<HandoverInspectionRow>[] = [
    {
      key: "inspectionTitle",
      header: "검사",
      className: "min-w-[240px]",
      render: (_, row) => (
        <div className="space-y-1">
          <div className="font-medium text-foreground">{row.inspectionTitle}</div>
          <div className="text-xs text-foreground-muted">{row.inspectionNo}</div>
          <div className="text-xs text-foreground-muted">{QC_HANDOVER_INSPECTION_TYPE_LABELS[row.inspectionType]}</div>
        </div>
      ),
    },
    {
      key: "workType",
      header: "공종/영역",
      className: "min-w-[220px]",
      render: (_, row) => (
        <div className="space-y-1">
          <div className="font-medium text-foreground">{row.workType || "-"}</div>
          <div className="text-xs text-foreground-muted">{buildAreaSummary(row)}</div>
        </div>
      ),
    },
    {
      key: "plannedInspectionDate",
      header: "일정",
      className: "min-w-[180px]",
      render: (_, row) => (
        <div className="space-y-1">
          <div className="text-sm text-foreground">예정 {formatDate(row.plannedInspectionDate)}</div>
          <div className="text-xs text-foreground-muted">실사 {formatDate(row.inspectedAt)}</div>
          <div className="text-xs text-foreground-muted">검사자 {row.inspectorName || "-"}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "상태",
      className: "min-w-[180px]",
      render: (_, row) => (
        <div className="flex flex-wrap gap-1">
          {renderStatusPill(row.status)}
          {renderResultPill(row.result)}
          {renderApprovalPill(row.approvalStatus)}
        </div>
      ),
    },
    {
      key: "openFindingCount",
      header: "미조치",
      className: "min-w-[110px]",
      render: (_, row) => (
        <div className={row.openFindingCount > 0 ? "font-medium text-amber-700" : "text-foreground-muted"}>
          {row.openFindingCount}건
        </div>
      ),
    },
    {
      key: "linkedNcrNo",
      header: "참조",
      className: "min-w-[220px]",
      render: (_, row) => (
        <div className="space-y-1 text-xs">
          <div className="text-foreground">{row.linkedProcessInspectionTitle || "공정 검사 미연결"}</div>
          <div className="text-foreground-muted">
            {row.linkedNcrNo ? `${row.linkedNcrNo} · ${row.linkedNcrTitle || "-"}` : "NCR 미연결"}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "작업",
      className: "w-[190px]",
      render: (_, row) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void openDetail(row._id);
            }}
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
          >
            상세
          </button>
          {canManage ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void openEdit(row._id);
                }}
                className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
              >
                수정
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteTarget({
                    _id: row._id,
                    inspectionNo: row.inspectionNo,
                    inspectionTitle: row.inspectionTitle,
                  });
                }}
                className="rounded-md border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                삭제
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-foreground-muted">전체 검사</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{totalCount}</p>
          <p className="mt-1 text-xs text-foreground-muted">인수/준공 검사 통합 건수</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-amber-800">미조치 지적사항</p>
          <p className="mt-2 text-2xl font-semibold text-amber-900">{unresolvedSummary}</p>
          <p className="mt-1 text-xs text-amber-700">보완 완료 전 검사 건수</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-sky-800">승인 요청</p>
          <p className="mt-2 text-2xl font-semibold text-sky-900">{approvalRequestedSummary}</p>
          <p className="mt-1 text-xs text-sky-700">승인 대기 중인 검사 건수</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium text-emerald-800">종결 완료</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">{closedSummary}</p>
          <p className="mt-1 text-xs text-emerald-700">완료 승인 후 종결된 건수</p>
        </div>
      </div>

      <QcFeedbackBanners message={message} error={error} />

      <QcFilterPanel
        description="인수 검사와 준공 검사 기록을 검색하고, 미조치 지적사항과 승인 대기 상태를 바로 확인합니다."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm((previous) => !previous || Boolean(editingId));
                setEditingId(null);
                setShowForm(true);
              }}
              disabled={isUserLoading}
              className="rounded-md bg-[#ecebe8] px-3 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {showForm && !editingId ? "등록 중" : "인수·준공 검사 등록"}
            </button>
          ) : null
        }
        footer={
          <div className="flex flex-wrap gap-2 text-xs text-foreground-muted">
            <span>결과는 체크리스트 기준으로 자동 계산됩니다.</span>
            <Link href="/qc/process-inspection" className="font-medium text-sky-700 hover:underline">
              공정 검사 화면
            </Link>
            <Link href="/qc/nonconformance" className="font-medium text-sky-700 hover:underline">
              NCR 화면
            </Link>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,0.8fr))_auto]">
          <FormInput
            label="검색"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              startTransition(() => setPage(1));
            }}
            placeholder="검사번호, 검사명, 공종, 영역, NCR"
          />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">검사 구분</span>
            <select
              value={inspectionTypeFilter}
              onChange={(event) => {
                setInspectionTypeFilter(event.target.value as "all" | QcHandoverInspectionType);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_HANDOVER_INSPECTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">검사 상태</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "all" | QcHandoverStatus);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_HANDOVER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">승인 상태</span>
            <select
              value={approvalStatusFilter}
              onChange={(event) => {
                setApprovalStatusFilter(event.target.value as "all" | QcHandoverApprovalStatus);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_HANDOVER_APPROVAL_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">결과</span>
            <select
              value={resultFilter}
              onChange={(event) => {
                setResultFilter(event.target.value as "all" | QcHandoverResult);
                startTransition(() => setPage(1));
              }}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_HANDOVER_RESULT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-3">
            <QcSortSelect
              compact
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={(value) => {
                setSortBy(value as QcHandoverSort);
                startTransition(() => setPage(1));
              }}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={unresolvedOnly}
              onChange={(event) => {
                setUnresolvedOnly(event.target.checked);
                startTransition(() => setPage(1));
              }}
              className="h-4 w-4 rounded border border-border"
            />
            미조치 지적사항만 보기
          </label>
          <button
            type="button"
            onClick={() => {
              setKeyword("");
              setInspectionTypeFilter("all");
              setStatusFilter("all");
              setApprovalStatusFilter("all");
              setResultFilter("all");
              setUnresolvedOnly(false);
              setSortBy("planned_date_desc");
              startTransition(() => setPage(1));
            }}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background-soft"
          >
            필터 초기화
          </button>
        </div>
      </QcFilterPanel>

      {showForm ? (
        <section className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {editingId ? "인수·준공 검사 수정" : "인수·준공 검사 등록"}
              </h2>
              <p className="text-sm text-foreground-muted">
                체크시트, 지적사항, 승인 상태, 공정검사/NCR 참조를 한 화면에서 관리합니다.
              </p>
            </div>
            <div className="text-xs text-foreground-muted">
              {isFormLoading ? "수정 정보를 불러오는 중..." : isUploading ? "첨부 업로드 중..." : null}
            </div>
          </div>

          <div className="mt-4 space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">검사 구분</span>
                <select
                  value={form.inspectionType}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      inspectionType: event.target.value as QcHandoverInspectionType,
                    }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  {QC_HANDOVER_INSPECTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <FormInput
                label="검사명"
                wrapperClassName="md:col-span-3"
                value={form.inspectionTitle}
                onChange={(event) => setForm((previous) => ({ ...previous, inspectionTitle: event.target.value }))}
                placeholder="예: 101동 12층 세대 인수 검사"
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">공종</label>
                <input
                  list="qc-handover-work-type-options"
                  value={form.workType}
                  onChange={(event) => setForm((previous) => ({ ...previous, workType: event.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                  placeholder="공종 선택 또는 직접입력"
                />
                <datalist id="qc-handover-work-type-options">
                  {workTypeOptions.map((option) => (
                    <option key={option.id} value={option.name}>
                      {option.description}
                    </option>
                  ))}
                </datalist>
              </div>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">영역 구분</span>
                <select
                  value={form.areaType}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      areaType: event.target.value as HandoverInspectionForm["areaType"],
                    }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  {QC_HANDOVER_AREA_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <FormInput
                label="영역"
                value={form.areaLabel}
                onChange={(event) => setForm((previous) => ({ ...previous, areaLabel: event.target.value }))}
                placeholder="예: 101동 12층 동측"
              />
              <FormInput
                label="세대"
                value={form.unitNo}
                onChange={(event) => setForm((previous) => ({ ...previous, unitNo: event.target.value }))}
                placeholder="예: 1203호"
              />
              <FormInput
                label="구역"
                value={form.zoneName}
                onChange={(event) => setForm((previous) => ({ ...previous, zoneName: event.target.value }))}
                placeholder="예: 공용복도 / 기계실"
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
                value={form.inspectedAt}
                onChange={(event) => setForm((previous) => ({ ...previous, inspectedAt: event.target.value }))}
              />
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">검사 상태</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      status: event.target.value as QcHandoverStatus,
                    }))
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  {QC_HANDOVER_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-border bg-background-soft px-3 py-2">
                <p className="text-xs font-medium text-foreground-muted">자동 계산 결과</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {renderResultPill(derivedResult)}
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                      derivedOpenFindingCount > 0
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    미조치 {derivedOpenFindingCount}건
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {(["requester", "inspector", "approver"] as const).map((target) => {
                const label = target === "requester" ? "요청자" : target === "inspector" ? "검사자" : "승인자";
                const memberIdField =
                  target === "requester"
                    ? form.requesterMemberId
                    : target === "inspector"
                      ? form.inspectorMemberId
                      : form.approverMemberId;
                const memberNameField =
                  target === "requester"
                    ? form.requesterName
                    : target === "inspector"
                      ? form.inspectorName
                      : form.approverName;
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
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">공정 검사 / NCR 참조</h3>
                  <p className="text-xs text-foreground-muted">미조치 항목을 기존 공정 검사 또는 NCR과 연결합니다.</p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-medium text-sky-700">
                  <Link href="/qc/process-inspection" className="hover:underline">
                    공정 검사 화면
                  </Link>
                  <Link href="/qc/nonconformance" className="hover:underline">
                    NCR 화면
                  </Link>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">연결 공정 검사</span>
                  <select
                    value={form.linkedProcessInspectionId}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, linkedProcessInspectionId: event.target.value }))
                    }
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    <option value="">선택 안 함</option>
                    {processInspectionOptions.map((option) => (
                      <option key={option._id} value={option._id}>
                        {option.inspectionTitle} / {option.workType} / {option.location}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-foreground-muted">
                    {selectedProcessInspection
                      ? `예정 ${formatDate(selectedProcessInspection.plannedInspectionDate)} · 상태 ${selectedProcessInspection.status}`
                      : "연결된 공정 검사가 없습니다."}
                  </p>
                </label>
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">연결 NCR</span>
                  <select
                    value={form.linkedNcrId}
                    onChange={(event) => setForm((previous) => ({ ...previous, linkedNcrId: event.target.value }))}
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    <option value="">선택 안 함</option>
                    {ncrOptions.map((option) => (
                      <option key={option._id} value={option._id}>
                        {option.ncrNo} / {option.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-foreground-muted">
                    {selectedNcr
                      ? `상태 ${selectedNcr.status} · 기한 ${formatDate(selectedNcr.dueDate)}`
                      : "연결된 NCR이 없습니다."}
                  </p>
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">체크시트 / 지적사항</h3>
                  <p className="text-xs text-foreground-muted">공간, 세대, 구역 단위 항목별 판정과 보완 요청을 함께 기록합니다.</p>
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
                    className="space-y-3 rounded-md border border-border bg-background-card p-3"
                  >
                    <div className="grid gap-3 md:grid-cols-3">
                      <FormInput
                        label="분류"
                        value={item.sectionTitle}
                        onChange={(event) => updateChecklistItem(item.itemId, "sectionTitle", event.target.value)}
                        placeholder="예: 마감 / 설비 / 공용부"
                      />
                      <FormInput
                        label="항목명"
                        value={item.checkpointTitle}
                        onChange={(event) => updateChecklistItem(item.itemId, "checkpointTitle", event.target.value)}
                        placeholder="예: 벽체 오염, 문짝 개폐, 배수 상태"
                      />
                      <FormInput
                        label="공간/세대/구역"
                        value={item.spaceLabel}
                        onChange={(event) => updateChecklistItem(item.itemId, "spaceLabel", event.target.value)}
                        placeholder="예: 주방, 1203호 욕실, 옥상 기계실"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">판정</span>
                        <select
                          value={item.status}
                          onChange={(event) => updateChecklistItem(item.itemId, "status", event.target.value)}
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        >
                          {QC_HANDOVER_CHECK_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">지적사항 상태</span>
                        <select
                          value={item.findingStatus}
                          onChange={(event) => updateChecklistItem(item.itemId, "findingStatus", event.target.value)}
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        >
                          {QC_HANDOVER_FINDING_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <FormInput
                        label="보완 기한"
                        type="date"
                        value={item.correctiveDueDate ? String(item.correctiveDueDate) : ""}
                        onChange={(event) => updateChecklistItem(item.itemId, "correctiveDueDate", event.target.value)}
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
                    <div className="grid gap-3 md:grid-cols-2">
                      <FormInput
                        label="체크 메모"
                        value={item.note}
                        onChange={(event) => updateChecklistItem(item.itemId, "note", event.target.value)}
                        placeholder="사진 위치, 특이사항, 점검 메모"
                      />
                      <FormInput
                        label="지적사항"
                        value={item.findingTitle}
                        onChange={(event) => updateChecklistItem(item.itemId, "findingTitle", event.target.value)}
                        placeholder="예: 세대 출입문 하부 간섭"
                      />
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">보완 요청</span>
                        <textarea
                          value={item.correctiveRequest}
                          onChange={(event) => updateChecklistItem(item.itemId, "correctiveRequest", event.target.value)}
                          className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                          placeholder="시공 보완 내용과 완료 기준"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">완료 메모</span>
                        <textarea
                          value={item.completionNote}
                          onChange={(event) => updateChecklistItem(item.itemId, "completionNote", event.target.value)}
                          className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                          placeholder="보완 완료 결과, 재확인 메모"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">검사 요약</span>
                <textarea
                  value={form.inspectionSummary}
                  onChange={(event) => setForm((previous) => ({ ...previous, inspectionSummary: event.target.value }))}
                  className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                  placeholder="검사 결과 총평, 잔여 리스크, 완료 판단 메모"
                />
              </label>
              <div className="rounded-lg border border-border bg-background-soft p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-foreground">승인 상태</span>
                    <select
                      value={form.approvalStatus}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          approvalStatus: event.target.value as QcHandoverApprovalStatus,
                        }))
                      }
                      className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                    >
                      {QC_HANDOVER_APPROVAL_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <FormInput
                    label="승인일"
                    type="date"
                    value={form.approvedAt}
                    onChange={(event) => setForm((previous) => ({ ...previous, approvedAt: event.target.value }))}
                  />
                </div>
                <label className="mt-3 block space-y-1">
                  <span className="block text-sm font-medium text-foreground">승인 메모</span>
                  <textarea
                    value={form.approvalComment}
                    onChange={(event) => setForm((previous) => ({ ...previous, approvalComment: event.target.value }))}
                    className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                    placeholder="승인 또는 반려 사유"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">증빙 첨부</h3>
                  <p className="text-xs text-foreground-muted">검사 사진, 체크시트, 보고서, 인수 서류를 첨부합니다.</p>
                </div>
                <label className="space-y-1 md:w-48">
                  <span className="block text-xs font-medium text-foreground-muted">업로드 구분</span>
                  <select
                    value={uploadCategory}
                    onChange={(event) => setUploadCategory(event.target.value as QcAttachmentCategory)}
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  >
                    {QC_HANDOVER_ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
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
                            {QC_HANDOVER_ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
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

            <FormInput
              label="이력 메모"
              value={form.historyNote}
              onChange={(event) => setForm((previous) => ({ ...previous, historyNote: event.target.value }))}
              placeholder="상태 변경, 승인 요청, 보완 완료 메모"
            />
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
        emptyMessage={isLoading ? "인수·준공 검사 목록을 불러오는 중입니다." : "등록된 인수·준공 검사 기록이 없습니다."}
        onRowClick={(row) => {
          void openDetail(row._id);
        }}
        getRowAriaLabel={(row) => `${row.inspectionTitle} 상세 열기`}
      />

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal
        open={Boolean(selectedItem) || isDetailLoading}
        title={selectedItem ? `${selectedItem.inspectionNo} 상세` : "인수·준공 검사 상세"}
        onClose={() => {
          if (!isDetailLoading) {
            setSelectedItem(null);
          }
        }}
      >
        {isDetailLoading ? (
          <div className="py-8 text-center text-sm text-foreground-muted">상세 정보를 불러오는 중입니다.</div>
        ) : selectedItem ? (
          <div className="space-y-5 text-sm text-foreground">
            <div className="flex flex-wrap gap-1">
              {renderStatusPill(selectedItem.status)}
              {renderResultPill(selectedItem.result)}
              {renderApprovalPill(selectedItem.approvalStatus)}
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                  selectedItem.openFindingCount > 0
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                미조치 {selectedItem.openFindingCount}건
              </span>
            </div>

            <dl className="grid gap-3 md:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-foreground-muted">검사번호 / 구분</dt>
                <dd className="mt-1 font-medium">
                  {selectedItem.inspectionNo} / {QC_HANDOVER_INSPECTION_TYPE_LABELS[selectedItem.inspectionType]}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">검사명</dt>
                <dd className="mt-1">{selectedItem.inspectionTitle}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">공종 / 영역</dt>
                <dd className="mt-1">
                  {selectedItem.workType} / {buildAreaSummary(selectedItem)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">예정일 / 실제일</dt>
                <dd className="mt-1">
                  {formatDate(selectedItem.plannedInspectionDate)} / {formatDate(selectedItem.inspectedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">요청자 / 검사자 / 승인자</dt>
                <dd className="mt-1">
                  {selectedItem.requesterName || "-"} / {selectedItem.inspectorName || "-"} / {selectedItem.approverName || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">승인일</dt>
                <dd className="mt-1">{formatDate(selectedItem.approvedAt)}</dd>
              </div>
            </dl>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border bg-background-soft p-3">
                <p className="text-xs font-medium text-foreground-muted">검사 요약</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{selectedItem.inspectionSummary || "-"}</p>
              </div>
              <div className="rounded-md border border-border bg-background-soft p-3">
                <p className="text-xs font-medium text-foreground-muted">승인 메모</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{selectedItem.approvalComment || "-"}</p>
              </div>
            </div>

            <div className="rounded-md border border-border bg-background-soft p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground-muted">연결 참조</p>
                <div className="flex gap-3 text-xs font-medium text-sky-700">
                  <Link href="/qc/process-inspection" className="hover:underline">
                    공정 검사
                  </Link>
                  <Link href="/qc/nonconformance" className="hover:underline">
                    NCR
                  </Link>
                </div>
              </div>
              <p className="mt-2 font-medium text-foreground">{selectedItem.linkedProcessInspectionTitle || "연결 공정 검사 없음"}</p>
              <p className="mt-1 text-sm text-foreground-muted">
                {selectedItem.linkedNcrNo
                  ? `${selectedItem.linkedNcrNo} / ${selectedItem.linkedNcrTitle || "-"}`
                  : "연결 NCR 없음"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">체크시트 / 지적사항</p>
              <div className="mt-2 space-y-2">
                {selectedItem.checklistItems.length > 0 ? (
                  selectedItem.checklistItems.map((item) => (
                    <div key={item.itemId} className="rounded-md border border-border bg-background-soft p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{item.checkpointTitle}</span>
                        <span className="text-xs text-foreground-muted">{item.sectionTitle || "-"}</span>
                        <span className="text-xs text-foreground-muted">{item.spaceLabel || "-"}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {QC_HANDOVER_CHECK_STATUS_LABELS[item.status]}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {QC_HANDOVER_FINDING_STATUS_LABELS[item.findingStatus]}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          기한 {formatDate(item.correctiveDueDate)}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-foreground-muted">체크 메모</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.note || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground-muted">지적사항</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.findingTitle || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground-muted">보완 요청</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.correctiveRequest || "-"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground-muted">완료 메모</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.completionNote || "-"}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-foreground-muted">
                    등록된 체크시트가 없습니다.
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">첨부 파일</p>
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
                          <span>{QC_HANDOVER_HISTORY_ACTION_LABELS[entry.actionType as QcHandoverHistoryAction]}</span>
                          <span>{formatDateTime(entry.actionDate)}</span>
                          <span>{entry.actorName || "-"}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {renderStatusPill(entry.status)}
                          {renderApprovalPill(entry.approvalStatus)}
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
        title="인수·준공 검사 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              삭제 후에는 복구할 수 없습니다.
            </div>
            <div className="space-y-1 text-sm text-foreground">
              <p className="font-medium">{deleteTarget.inspectionNo}</p>
              <p>{deleteTarget.inspectionTitle}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background-soft disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={Boolean(deletingId)}
                className="rounded-md border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
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
          {memberError ? <p className="text-xs text-danger">{memberError}</p> : null}
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
