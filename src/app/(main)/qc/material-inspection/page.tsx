"use client";

import { startTransition, useCallback, useDeferredValue, useEffect, useState } from "react";
import { QcFeedbackBanners } from "@/components/qc/feedback-banners";
import { QcFilterPanel } from "@/components/qc/filter-panel";
import { QcResultBadge } from "@/components/qc/result-badge";
import { QcSortSelect } from "@/components/qc/sort-select";
import { DataTable } from "@/components/ui/data-table";
import { FileUpload } from "@/components/ui/file-upload";
import { FormInput } from "@/components/ui/form-input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import type { DataTableColumn } from "@/components/ui/data-table";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import { buildUploadUrl } from "@/lib/file-asset-url";
import { QC_ATTACHMENT_CATEGORY_LABELS, type QcAttachmentCategory } from "@/lib/qc-core";
import {
  QC_MATERIAL_CATEGORY_LABELS,
  QC_MATERIAL_CATEGORY_OPTIONS,
  QC_MATERIAL_INSPECTION_ATTACHMENT_CATEGORY_OPTIONS,
  QC_MATERIAL_INSPECTION_CHECK_STATUS_LABELS,
  QC_MATERIAL_INSPECTION_CHECK_STATUS_OPTIONS,
  QC_MATERIAL_INSPECTION_DISPOSITION_LABELS,
  QC_MATERIAL_INSPECTION_DISPOSITION_OPTIONS,
  QC_MATERIAL_INSPECTION_HISTORY_ACTION_LABELS,
  QC_MATERIAL_INSPECTION_NCR_STATUS_LABELS,
  QC_MATERIAL_INSPECTION_NCR_STATUS_OPTIONS,
  QC_MATERIAL_INSPECTION_RESULT_LABELS,
  QC_MATERIAL_INSPECTION_RESULT_VALUES,
  QC_MATERIAL_INSPECTION_SORT_LABELS,
  QC_MATERIAL_INSPECTION_SORT_VALUES,
  type QcMaterialCategory,
  type QcMaterialInspectionAttachment,
  type QcMaterialInspectionCheckStatus,
  type QcMaterialInspectionChecklistItem,
  type QcMaterialInspectionDisposition,
  type QcMaterialInspectionHistoryAction,
  type QcMaterialInspectionHistoryEntry,
  type QcMaterialInspectionNcrStatus,
  type QcMaterialInspectionResult,
  type QcMaterialInspectionSort,
} from "@/lib/qc-material-inspections";

type InspectionRow = {
  _id: string;
  materialCategory: QcMaterialCategory;
  materialName: string;
  specification: string;
  supplier: string;
  lotNo: string;
  inboundDate: string;
  quantity: number;
  unit: string;
  inspectionDate: string;
  result: QcMaterialInspectionResult;
  disposition: QcMaterialInspectionDisposition;
  inspector: string;
  linkedItpPlanId: string;
  linkedItpPlanTitle: string;
  linkedItpCheckpointId: string;
  linkedItpCheckpointTitle: string;
  inspectionStandard: string;
  checklistItems: QcMaterialInspectionChecklistItem[];
  decisionReason: string;
  remarks: string;
  attachments: QcMaterialInspectionAttachment[];
  fileAssetId?: string | null;
  fileName?: string;
  fileUrl?: string;
  ncrStatus: QcMaterialInspectionNcrStatus;
  ncrReference: string;
  history: QcMaterialInspectionHistoryEntry[];
  updatedAt?: string;
  actions?: string;
};

type InspectionResponse = {
  ok: boolean;
  data: InspectionRow[];
  meta?: {
    page: number;
    totalPages: number;
  };
  error?: string;
};

type InspectionDetailResponse = {
  ok: boolean;
  data?: InspectionRow;
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

type ItpOptionsResponse = {
  ok: boolean;
  data?: {
    itpOptions?: ItpOption[];
  };
  error?: string;
};

type ItpDetailResponse = {
  ok: boolean;
  data?: {
    checkpoints?: ItpCheckpoint[];
  };
  error?: string;
};

type MaterialInspectionForm = {
  materialCategory: QcMaterialCategory;
  materialName: string;
  specification: string;
  supplier: string;
  lotNo: string;
  inboundDate: string;
  quantity: string;
  unit: string;
  inspectionDate: string;
  result: QcMaterialInspectionResult;
  disposition: QcMaterialInspectionDisposition;
  inspector: string;
  linkedItpPlanId: string;
  linkedItpCheckpointId: string;
  inspectionStandard: string;
  checklistItems: QcMaterialInspectionChecklistItem[];
  decisionReason: string;
  remarks: string;
  attachments: QcMaterialInspectionAttachment[];
  ncrStatus: QcMaterialInspectionNcrStatus;
  ncrReference: string;
  historyNote: string;
};

type DeleteTarget = Pick<InspectionRow, "_id" | "materialName" | "inspectionDate">;

const SITE_ID_KEY = "pmis:siteId";

const tabs: Array<{ key: "all" | QcMaterialInspectionResult; label: string }> = [
  { key: "all", label: "전체" },
  ...QC_MATERIAL_INSPECTION_RESULT_VALUES.map((value) => ({
    key: value,
    label: QC_MATERIAL_INSPECTION_RESULT_LABELS[value],
  })),
];

const SORT_OPTIONS = QC_MATERIAL_INSPECTION_SORT_VALUES.map((value) => ({
  value,
  label: QC_MATERIAL_INSPECTION_SORT_LABELS[value],
}));

function createDefaultChecklist(): QcMaterialInspectionChecklistItem[] {
  return [
    { itemId: "appearance", label: "외관 및 손상 여부", status: "pending", note: "" },
    { itemId: "spec", label: "규격 및 라벨 일치 여부", status: "pending", note: "" },
  ];
}

function createEmptyForm(defaultInspector = ""): MaterialInspectionForm {
  return {
    materialCategory: "other",
    materialName: "",
    specification: "",
    supplier: "",
    lotNo: "",
    inboundDate: "",
    quantity: "0",
    unit: "",
    inspectionDate: "",
    result: "pending",
    disposition: "none",
    inspector: defaultInspector,
    linkedItpPlanId: "",
    linkedItpCheckpointId: "",
    inspectionStandard: "",
    checklistItems: createDefaultChecklist(),
    decisionReason: "",
    remarks: "",
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

function mapDetailToForm(item: InspectionRow, defaultInspector = ""): MaterialInspectionForm {
  return {
    materialCategory: item.materialCategory ?? "other",
    materialName: item.materialName ?? "",
    specification: item.specification ?? "",
    supplier: item.supplier ?? "",
    lotNo: item.lotNo ?? "",
    inboundDate: formatDate(item.inboundDate),
    quantity: String(item.quantity ?? 0),
    unit: item.unit ?? "",
    inspectionDate: formatDate(item.inspectionDate),
    result: item.result ?? "pending",
    disposition: item.disposition ?? "none",
    inspector: item.inspector ?? defaultInspector,
    linkedItpPlanId: item.linkedItpPlanId ?? "",
    linkedItpCheckpointId: item.linkedItpCheckpointId ?? "",
    inspectionStandard: item.inspectionStandard ?? "",
    checklistItems:
      item.checklistItems?.length > 0
        ? item.checklistItems.map((checklist, index) => ({
            itemId: checklist.itemId || `item-${index + 1}`,
            label: checklist.label || "",
            status: checklist.status || "pending",
            note: checklist.note || "",
          }))
        : createDefaultChecklist(),
    decisionReason: item.decisionReason ?? "",
    remarks: item.remarks ?? "",
    attachments:
      item.attachments?.map((attachment, index) => ({
        fileAssetId: attachment.fileAssetId,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
        category: attachment.category,
        sortOrder: Number(attachment.sortOrder ?? index),
      })) ?? [],
    ncrStatus: item.ncrStatus ?? "none",
    ncrReference: item.ncrReference ?? "",
    historyNote: "",
  };
}

function countChecklistFailures(items: QcMaterialInspectionChecklistItem[]) {
  return items.filter((item) => item.status === "fail").length;
}

function inferAttachmentCategory(fileName: string): QcAttachmentCategory {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") || lowerName.endsWith(".png") || lowerName.endsWith(".webp")) {
    return "photo";
  }
  if (lowerName.endsWith(".pdf")) {
    return "report";
  }
  return "other";
}

function renderDispositionBadge(disposition: QcMaterialInspectionDisposition) {
  const badgeClassName =
    disposition === "hold"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : disposition === "returned"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClassName}`}>
      {QC_MATERIAL_INSPECTION_DISPOSITION_LABELS[disposition]}
    </span>
  );
}

function renderNcrBadge(status: QcMaterialInspectionNcrStatus) {
  const badgeClassName =
    status === "linked"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : status === "recommended"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-border bg-background-soft text-foreground-muted";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClassName}`}>
      {QC_MATERIAL_INSPECTION_NCR_STATUS_LABELS[status]}
    </span>
  );
}

export default function QcMaterialInspectionPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = hasMinRole(user.role, "manager");

  const [items, setItems] = useState<InspectionRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const [resultFilter, setResultFilter] = useState<"all" | QcMaterialInspectionResult>("all");
  const [sortBy, setSortBy] = useState<QcMaterialInspectionSort>("inspection_date_desc");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MaterialInspectionForm>(() => createEmptyForm());
  const [selectedItem, setSelectedItem] = useState<InspectionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [itpOptions, setItpOptions] = useState<ItpOption[]>([]);
  const [checkpoints, setCheckpoints] = useState<ItpCheckpoint[]>([]);
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

  const loadItems = useCallback(
    async (nextPage: number) => {
      const siteId = readSiteId();
      if (!siteId) {
        setItems([]);
        setTotalPages(1);
        setError("현장을 먼저 선택해 주세요.");
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          siteId,
          page: String(nextPage),
          limit: "10",
          q: deferredKeyword,
          sort: sortBy,
        });

        if (resultFilter !== "all") {
          params.set("result", resultFilter);
        }

        const response = await fetch(`/api/qc/material-inspections?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as InspectionResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "자재 검사 목록 조회 실패");
        }

        setItems(Array.isArray(result.data) ? result.data : []);
        setPage(result.meta?.page ?? nextPage);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "자재 검사 목록 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [deferredKeyword, resultFilter, sortBy],
  );

  useEffect(() => {
    void loadItems(page);
  }, [loadItems, page]);

  function resetForm() {
    setForm(createEmptyForm(user.userName ?? ""));
    setEditingId(null);
    setCheckpoints([]);
    setUploadCategory("photo");
    setUploadInputKey((previous) => previous + 1);
  }

  function resetFilters() {
    setKeyword("");
    setResultFilter("all");
    setSortBy("inspection_date_desc");
    setPage(1);
  }

  async function loadItpOptions() {
    const siteId = readSiteId();
    if (!siteId) {
      setItpOptions([]);
      return;
    }

    const response = await fetch(`/api/qc/itp/options?siteId=${siteId}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as ItpOptionsResponse;
    if (!result.ok) {
      throw new Error(result.error ?? "ITP 옵션 조회 실패");
    }
    setItpOptions(result.data?.itpOptions ?? []);
  }

  async function loadItpCheckpoints(planId: string) {
    if (!planId) {
      setCheckpoints([]);
      return [];
    }

    const response = await fetch(`/api/qc/itp/${planId}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as ItpDetailResponse;
    if (!result.ok || !result.data) {
      throw new Error(result.error ?? "ITP 체크포인트 조회 실패");
    }

    const nextCheckpoints = result.data.checkpoints ?? [];
    setCheckpoints(nextCheckpoints);
    return nextCheckpoints;
  }

  async function fetchInspectionDetail(inspectionId: string) {
    const response = await fetch(`/api/qc/material-inspections/${inspectionId}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as InspectionDetailResponse;
    if (!result.ok || !result.data) {
      throw new Error(result.error ?? "자재 검사 상세 조회 실패");
    }
    return result.data;
  }

  async function openCreateForm() {
    setShowForm(true);
    setMessage(null);
    setError(null);
    resetForm();

    try {
      await loadItpOptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ITP 옵션 조회 실패");
    }
  }

  async function openEditForm(inspectionId: string) {
    setShowForm(true);
    setIsFormLoading(true);
    setEditingId(inspectionId);
    setMessage(null);
    setError(null);

    try {
      const [detail] = await Promise.all([fetchInspectionDetail(inspectionId), loadItpOptions()]);
      setForm(mapDetailToForm(detail, user.userName ?? ""));
      if (detail.linkedItpPlanId) {
        await loadItpCheckpoints(detail.linkedItpPlanId);
      } else {
        setCheckpoints([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "자재 검사 편집 정보 조회 실패");
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
      setError(err instanceof Error ? err.message : "자재 검사 상세 조회 실패");
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
      const uploadedAttachments: QcMaterialInspectionAttachment[] = [];

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
          category: uploadCategory || inferAttachmentCategory(result.data.originalName),
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
      setMessage(`${uploadedAttachments.length}개의 첨부 파일을 등록했습니다.`);
      setUploadInputKey((previous) => previous + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "첨부 업로드 실패");
    } finally {
      setIsUploading(false);
    }
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
        editingId ? `/api/qc/material-inspections/${editingId}` : "/api/qc/material-inspections",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            quantity: Number(form.quantity || 0),
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
        throw new Error(result.error ?? "자재 검사 저장 실패");
      }

      const successMessage = editingId ? "자재 검사 기록을 수정했습니다." : "자재 검사 기록을 등록했습니다.";
      setShowForm(false);
      resetForm();
      setMessage(successMessage);
      setSelectedItem(null);
      setPage(1);
      await loadItems(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "자재 검사 저장 실패");
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
      const response = await fetch(`/api/qc/material-inspections/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "자재 검사 삭제 실패");
      }

      setDeleteTarget(null);
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
      setMessage("자재 검사 기록을 삭제했습니다.");
      await loadItems(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "자재 검사 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<InspectionRow>[] = [
    {
      key: "materialName",
      header: "자재",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="font-medium text-foreground">{row.materialName}</div>
          <div className="text-xs text-foreground-muted">
            {QC_MATERIAL_CATEGORY_LABELS[row.materialCategory]} / {row.specification || "규격 미입력"}
          </div>
          <div className="text-xs text-foreground-muted">
            {row.supplier || "공급사 미입력"}
            {row.lotNo ? ` / LOT ${row.lotNo}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "inspectionStandard",
      header: "ITP / 기준",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{row.linkedItpPlanTitle || "ITP 미연결"}</div>
          <div className="text-xs text-foreground-muted">{row.linkedItpCheckpointTitle || "체크포인트 미선택"}</div>
          <div className="line-clamp-2 text-xs text-foreground-muted">{row.inspectionStandard || "검사 기준 미입력"}</div>
        </div>
      ),
    },
    {
      key: "inspectionDate",
      header: "검사 / 상태",
      className: "w-44",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-sm text-foreground">{formatDate(row.inspectionDate)}</div>
          <div className="flex flex-wrap gap-1">
            <QcResultBadge result={row.result} />
            {renderDispositionBadge(row.disposition)}
            {renderNcrBadge(row.ncrStatus)}
          </div>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "수량 / 검수자",
      className: "w-36",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-sm text-foreground">{`${row.quantity} ${row.unit || ""}`.trim() || "-"}</div>
          <div className="text-xs text-foreground-muted">{row.inspector || "-"}</div>
          <div className="text-xs text-foreground-muted">반입일 {formatDate(row.inboundDate)}</div>
        </div>
      ),
    },
    {
      key: "remarks",
      header: "증빙 / 이력",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-xs text-foreground-muted">
            첨부 {row.attachments.length}건 / 체크 부적합 {countChecklistFailures(row.checklistItems)}건
          </div>
          <div className="line-clamp-2 text-sm text-foreground">{row.decisionReason || row.remarks || "-"}</div>
          {row.attachments[0]?.fileUrl ? (
            <a
              href={row.attachments[0].fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-xs font-medium text-sky-700 hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              첫 첨부 열기
            </a>
          ) : null}
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
                  materialName: row.materialName,
                  inspectionDate: row.inspectionDate,
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
          <h1 className="text-xl font-semibold text-foreground">자재 검사</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            반입 자재의 검사 기준, 판정, 재검 이력, 증빙 파일과 NCR 검토 포인트를 함께 관리합니다.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => {
              if (showForm && !editingId) {
                setShowForm(false);
                resetForm();
                return;
              }
              void openCreateForm();
            }}
            className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUserLoading}
          >
            {showForm && !editingId ? "등록 닫기" : "검사 등록"}
          </button>
        ) : null}
      </div>

      <QcFeedbackBanners message={message} error={error} />

      <QcFilterPanel
        description="자재명, 공급사, LOT, ITP, 판정 사유를 기준으로 검색하고 결과별로 분류할 수 있습니다."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                startTransition(() => setPage(1));
                void loadItems(1);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background-soft"
            >
              조회
            </button>
            <button
              type="button"
              onClick={resetFilters}
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
                setSortBy(value as QcMaterialInspectionSort);
                startTransition(() => setPage(1));
              }}
            />
            <p className="text-xs text-foreground-muted">
              현재 {items.length}건 표시 / 페이지 {page} / 총 {totalPages}페이지
            </p>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <FormInput
            label="검색어"
            placeholder="자재명, 공급사, LOT, ITP, 판정 사유"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              startTransition(() => setPage(1));
            }}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">결과 필터</label>
            <div className="flex flex-wrap gap-1 rounded-md border border-border bg-background-card p-1">
              {tabs.map((tab) => {
                const isActive = resultFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setResultFilter(tab.key);
                      startTransition(() => setPage(1));
                    }}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive
                        ? "bg-[#ecebe8] font-medium text-foreground"
                        : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </QcFilterPanel>

      {showForm ? (
        <section className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {editingId ? "자재 검사 수정" : "자재 검사 등록"}
              </h2>
              <p className="text-sm text-foreground-muted">
                자재 기본 정보, ITP 기준, 체크리스트, 증빙 파일과 후속 조치 상태를 함께 관리합니다.
              </p>
            </div>
            <div className="text-xs text-foreground-muted">
              {isFormLoading ? "수정 정보를 불러오는 중..." : isUploading ? "첨부 업로드 중..." : null}
            </div>
          </div>

          <div className="mt-4 space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">자재 분류</span>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  value={form.materialCategory}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      materialCategory: event.target.value as QcMaterialCategory,
                    }))
                  }
                  disabled={isFormLoading}
                >
                  {QC_MATERIAL_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <FormInput
                label="자재명"
                value={form.materialName}
                onChange={(event) => setForm((previous) => ({ ...previous, materialName: event.target.value }))}
              />
              <FormInput
                label="규격"
                value={form.specification}
                onChange={(event) => setForm((previous) => ({ ...previous, specification: event.target.value }))}
              />
              <FormInput
                label="공급사"
                value={form.supplier}
                onChange={(event) => setForm((previous) => ({ ...previous, supplier: event.target.value }))}
              />
              <FormInput
                label="LOT 번호"
                value={form.lotNo}
                onChange={(event) => setForm((previous) => ({ ...previous, lotNo: event.target.value }))}
              />
              <FormInput
                label="반입일"
                type="date"
                value={form.inboundDate}
                onChange={(event) => setForm((previous) => ({ ...previous, inboundDate: event.target.value }))}
              />
              <FormInput
                label="수량"
                type="number"
                min="0"
                value={form.quantity}
                onChange={(event) => setForm((previous) => ({ ...previous, quantity: event.target.value }))}
              />
              <FormInput
                label="단위"
                value={form.unit}
                onChange={(event) => setForm((previous) => ({ ...previous, unit: event.target.value }))}
              />
              <FormInput
                label="검수일"
                type="date"
                value={form.inspectionDate}
                onChange={(event) => setForm((previous) => ({ ...previous, inspectionDate: event.target.value }))}
              />
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">검수 결과</span>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  value={form.result}
                  onChange={(event) =>
                    setForm((previous) => {
                      const nextResult = event.target.value as QcMaterialInspectionResult;
                      return {
                        ...previous,
                        result: nextResult,
                        ncrStatus:
                          nextResult === "fail"
                            ? previous.ncrStatus === "none"
                              ? "recommended"
                              : previous.ncrStatus
                            : previous.ncrStatus === "recommended"
                              ? "none"
                              : previous.ncrStatus,
                      };
                    })
                  }
                >
                  {QC_MATERIAL_INSPECTION_RESULT_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {QC_MATERIAL_INSPECTION_RESULT_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">보류 / 반출</span>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  value={form.disposition}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      disposition: event.target.value as QcMaterialInspectionDisposition,
                    }))
                  }
                >
                  {QC_MATERIAL_INSPECTION_DISPOSITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <FormInput
                label="검수자"
                value={form.inspector}
                placeholder={user.userName ?? "검수자명"}
                onChange={(event) => setForm((previous) => ({ ...previous, inspector: event.target.value }))}
              />
            </div>

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">ITP 참조</h3>
                  <p className="text-xs text-foreground-muted">연결된 계획과 체크포인트 기준을 자재 검사에 그대로 반영합니다.</p>
                </div>
                <a
                  href="/qc/itp"
                  className="text-xs font-medium text-sky-700 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  ITP 화면 열기
                </a>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">ITP 계획</span>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                    value={form.linkedItpPlanId}
                    onChange={(event) => {
                      const nextPlanId = event.target.value;
                      setForm((previous) => ({
                        ...previous,
                        linkedItpPlanId: nextPlanId,
                        linkedItpCheckpointId: "",
                        inspectionStandard: "",
                      }));
                      void loadItpCheckpoints(nextPlanId).catch((err) => {
                        setError(err instanceof Error ? err.message : "ITP 체크포인트 조회 실패");
                      });
                    }}
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
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                    value={form.linkedItpCheckpointId}
                    onChange={(event) => {
                      const nextCheckpointId = event.target.value;
                      const checkpoint = checkpoints.find((item) => item.checkpointId === nextCheckpointId);
                      setForm((previous) => ({
                        ...previous,
                        linkedItpCheckpointId: nextCheckpointId,
                        inspectionStandard: checkpoint?.acceptanceCriteria || previous.inspectionStandard,
                      }));
                    }}
                    disabled={!form.linkedItpPlanId}
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
                  <span className="block text-sm font-medium text-foreground">검사 기준</span>
                  <textarea
                    value={form.inspectionStandard}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, inspectionStandard: event.target.value }))
                    }
                    className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                    placeholder="ITP acceptance criteria 또는 현장 기준을 입력"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">검사 체크리스트</h3>
                  <p className="text-xs text-foreground-muted">체크 항목별 적합/부적합과 메모를 남겨 재검 근거로 사용합니다.</p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-background-card"
                  onClick={() =>
                    setForm((previous) => ({
                      ...previous,
                      checklistItems: [
                        ...previous.checklistItems,
                        {
                          itemId: `item-${previous.checklistItems.length + 1}`,
                          label: "",
                          status: "pending",
                          note: "",
                        },
                      ],
                    }))
                  }
                >
                  항목 추가
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {form.checklistItems.map((item, index) => (
                  <div
                    key={`${item.itemId}-${index}`}
                    className="grid gap-3 rounded-md border border-border bg-background-card p-3 md:grid-cols-[minmax(0,1.6fr)_180px_minmax(0,1fr)_auto]"
                  >
                    <FormInput
                      label="항목명"
                      value={item.label}
                      placeholder="예: 외관 균열 여부"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          checklistItems: previous.checklistItems.map((checklist, checklistIndex) =>
                            checklistIndex === index
                              ? {
                                  ...checklist,
                                  label: event.target.value,
                                }
                              : checklist,
                          ),
                        }))
                      }
                    />
                    <label className="space-y-1">
                      {index === 0 ? <span className="block text-sm font-medium text-foreground">판정</span> : <span className="block text-sm font-medium text-transparent">판정</span>}
                      <select
                        className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        value={item.status}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            checklistItems: previous.checklistItems.map((checklist, checklistIndex) =>
                              checklistIndex === index
                                ? {
                                    ...checklist,
                                    status: event.target.value as QcMaterialInspectionCheckStatus,
                                  }
                                : checklist,
                            ),
                          }))
                        }
                      >
                        {QC_MATERIAL_INSPECTION_CHECK_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <FormInput
                      label="메모"
                      value={item.note}
                      placeholder="부적합 사유 또는 메모"
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          checklistItems: previous.checklistItems.map((checklist, checklistIndex) =>
                            checklistIndex === index
                              ? {
                                  ...checklist,
                                  note: event.target.value,
                                }
                              : checklist,
                          ),
                        }))
                      }
                    />
                    <div className="flex items-end">
                      <button
                        type="button"
                        className="h-9 rounded-md border border-rose-200 px-3 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        onClick={() =>
                          setForm((previous) => ({
                            ...previous,
                            checklistItems:
                              previous.checklistItems.length > 1
                                ? previous.checklistItems.filter((_, checklistIndex) => checklistIndex !== index)
                                : createDefaultChecklist(),
                          }))
                        }
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
                <span className="block text-sm font-medium text-foreground">판정 사유</span>
                <textarea
                  value={form.decisionReason}
                  onChange={(event) => setForm((previous) => ({ ...previous, decisionReason: event.target.value }))}
                  className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                  placeholder="합격/불합격/재검 판정 근거"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">비고</span>
                <textarea
                  value={form.remarks}
                  onChange={(event) => setForm((previous) => ({ ...previous, remarks: event.target.value }))}
                  className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                  placeholder="후속 조치, 시험 성적서 요청, 공급사 메모"
                />
              </label>
            </div>

            <div className="rounded-lg border border-border bg-background-soft p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">증빙 첨부</h3>
                  <p className="text-xs text-foreground-muted">
                    시험성적서, 체크시트, 사진을 다건으로 등록하고 유형별로 구분합니다.
                  </p>
                </div>
                <label className="space-y-1 md:w-48">
                  <span className="block text-xs font-medium text-foreground-muted">업로드 구분</span>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                    value={uploadCategory}
                    onChange={(event) => setUploadCategory(event.target.value as QcAttachmentCategory)}
                  >
                    {QC_MATERIAL_INSPECTION_ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
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
                          <div className="text-xs text-foreground-muted">{attachment.fileUrl ? "첨부 링크 준비됨" : "업로드 정보만 저장"}</div>
                        </div>
                        <label className="space-y-1">
                          <span className="block text-xs font-medium text-foreground-muted">구분</span>
                          <select
                            className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
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
                          >
                            {QC_MATERIAL_INSPECTION_ATTACHMENT_CATEGORY_OPTIONS.map((option) => (
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
                            <span className="rounded-md border border-border px-3 py-2 text-xs text-foreground-muted">링크 없음</span>
                          )}
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            className="rounded-md border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
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
                  <h3 className="text-sm font-semibold text-foreground">후속 조치 / NCR</h3>
                  <p className="text-xs text-foreground-muted">불합격 또는 재검 대상은 NCR 검토 상태와 참조 번호를 남깁니다.</p>
                </div>
                <a
                  href="/qc/nonconformance"
                  className="text-xs font-medium text-sky-700 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  NCR 화면 열기
                </a>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-foreground">NCR 상태</span>
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                    value={form.ncrStatus}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        ncrStatus: event.target.value as QcMaterialInspectionNcrStatus,
                      }))
                    }
                  >
                    {QC_MATERIAL_INSPECTION_NCR_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <FormInput
                  label="NCR 참조"
                  value={form.ncrReference}
                  placeholder="예: NCR-20260312-001"
                  onChange={(event) => setForm((previous) => ({ ...previous, ncrReference: event.target.value }))}
                />
                <FormInput
                  label="이력 메모"
                  value={form.historyNote}
                  placeholder="재검 요청, 보류 사유, 반출 사유"
                  onChange={(event) => setForm((previous) => ({ ...previous, historyNote: event.target.value }))}
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
        emptyMessage={isLoading ? "자재 검사 목록을 불러오는 중입니다." : "등록된 자재 검사 기록이 없습니다."}
        onRowClick={(row) => {
          void openDetail(row._id);
        }}
        getRowAriaLabel={(row) => `${row.materialName} 자재 검사 상세 열기`}
      />

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal
        open={Boolean(selectedItem) || isDetailLoading}
        title={selectedItem ? `${selectedItem.materialName} 검사 상세` : "자재 검사 상세"}
        onClose={() => {
          if (isDetailLoading) {
            return;
          }
          setSelectedItem(null);
        }}
      >
        {isDetailLoading ? (
          <div className="py-8 text-center text-sm text-foreground-muted">자재 검사 상세를 불러오는 중입니다.</div>
        ) : selectedItem ? (
          <div className="space-y-5 text-sm text-foreground">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap gap-1">
                  <QcResultBadge result={selectedItem.result} />
                  {renderDispositionBadge(selectedItem.disposition)}
                  {renderNcrBadge(selectedItem.ncrStatus)}
                </div>
                <p className="mt-2 text-xs text-foreground-muted">
                  최근 업데이트 {formatDateTime(selectedItem.updatedAt)}
                </p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background-soft"
                  onClick={() => {
                    setSelectedItem(null);
                    void openEditForm(selectedItem._id);
                  }}
                >
                  수정 열기
                </button>
              ) : null}
            </div>

            <dl className="grid gap-3 md:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-foreground-muted">자재명</dt>
                <dd className="mt-1 font-medium">{selectedItem.materialName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">자재 분류</dt>
                <dd className="mt-1">{QC_MATERIAL_CATEGORY_LABELS[selectedItem.materialCategory]}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">규격</dt>
                <dd className="mt-1">{selectedItem.specification || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">공급사 / LOT</dt>
                <dd className="mt-1">
                  {selectedItem.supplier || "-"}
                  {selectedItem.lotNo ? ` / ${selectedItem.lotNo}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">수량</dt>
                <dd className="mt-1">{`${selectedItem.quantity} ${selectedItem.unit || ""}`.trim() || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">반입일 / 검수일</dt>
                <dd className="mt-1">
                  {formatDate(selectedItem.inboundDate)} / {formatDate(selectedItem.inspectionDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">검수자</dt>
                <dd className="mt-1">{selectedItem.inspector || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">NCR 참조</dt>
                <dd className="mt-1">{selectedItem.ncrReference || "-"}</dd>
              </div>
            </dl>

            <div className="rounded-md border border-border bg-background-soft p-3">
              <p className="text-xs font-medium text-foreground-muted">ITP 참조</p>
              <p className="mt-2 font-medium text-foreground">{selectedItem.linkedItpPlanTitle || "ITP 미연결"}</p>
              <p className="mt-1 text-sm text-foreground-muted">
                {selectedItem.linkedItpCheckpointTitle || "체크포인트 미선택"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                {selectedItem.inspectionStandard || "검사 기준 미입력"}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border bg-background-soft p-3">
                <p className="text-xs font-medium text-foreground-muted">판정 사유</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{selectedItem.decisionReason || "-"}</p>
              </div>
              <div className="rounded-md border border-border bg-background-soft p-3">
                <p className="text-xs font-medium text-foreground-muted">비고</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{selectedItem.remarks || "-"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">검사 체크리스트</p>
              <div className="mt-2 space-y-2">
                {selectedItem.checklistItems.length > 0 ? (
                  selectedItem.checklistItems.map((checklist) => (
                    <div
                      key={checklist.itemId}
                      className="grid gap-2 rounded-md border border-border bg-background-soft px-3 py-2 md:grid-cols-[minmax(0,1.6fr)_140px_minmax(0,1fr)]"
                    >
                      <div className="font-medium text-foreground">{checklist.label}</div>
                      <div className="text-sm text-foreground-muted">
                        {QC_MATERIAL_INSPECTION_CHECK_STATUS_LABELS[checklist.status]}
                      </div>
                      <div className="text-sm text-foreground">{checklist.note || "-"}</div>
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
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground-muted">이력</p>
                <a
                  href="/qc/nonconformance"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-sky-700 hover:underline"
                >
                  NCR 화면 열기
                </a>
              </div>
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
                          <span>{QC_MATERIAL_INSPECTION_HISTORY_ACTION_LABELS[entry.actionType as QcMaterialInspectionHistoryAction]}</span>
                          <span>{formatDateTime(entry.actionDate)}</span>
                          <span>{entry.actorName || "-"}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <QcResultBadge result={entry.result} />
                          {renderDispositionBadge(entry.disposition)}
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
        title="자재 검사 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4 text-sm text-foreground">
            <p>
              <strong>{deleteTarget.materialName}</strong> 자재 검사 기록을 삭제합니다.
            </p>
            <p className="text-foreground-muted">검수일: {formatDate(deleteTarget.inspectionDate)}</p>
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
    </section>
  );
}
