"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DataTable, Modal, Pagination } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";

type ReviewStatus = "pending" | "approved" | "rejected";
type ReviewItemResult = "pass" | "fail" | "na";

type ReviewRow = {
  _id: string;
  contractorName: string;
  workType: string;
  contractAmount: number;
  status: ReviewStatus;
  requestDate: string;
  approvedDate?: string;
  rejectionReason?: string;
};

type ReviewItem = {
  checkItem: string;
  result: ReviewItemResult;
  remarks: string;
};

type ReviewDetail = ReviewRow & {
  remarks?: string;
  items: ReviewItem[];
};

type ReviewFormState = {
  contractorName: string;
  workType: string;
  contractAmount: number;
  remarks: string;
};

type WorkTypeOption = {
  id: string;
  code: string;
  name: string;
  description: string;
};

type RejectTarget = {
  _id: string;
  contractorName: string;
  workType: string;
  contractAmount: number;
  rejectionReason?: string;
};

type ConfirmTarget = {
  _id: string;
  contractorName: string;
  workType: string;
  contractAmount: number;
  nextStatus: "approved" | "pending";
};

type DeleteTarget = {
  _id: string;
  contractorName: string;
  workType: string;
  contractAmount: number;
};

type DetailMode = "view" | "edit";

type ReviewFormFieldsProps = {
  form: ReviewFormState;
  workTypeOptions: WorkTypeOption[];
  isLoadingWorkTypeOptions?: boolean;
  disabled?: boolean;
  onChange: (patch: Partial<ReviewFormState>) => void;
};

type ReviewItemsFieldsProps = {
  items: ReviewItem[];
  disabled?: boolean;
  onChangeItem: (index: number, field: keyof ReviewItem, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
};

const SITE_ID_KEY = "pmis:siteId";

const statusLabel: Record<ReviewStatus, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
};

const statusToneClass: Record<ReviewStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

const statusTabs: ReadonlyArray<{ key: "" | ReviewStatus; label: string }> = [
  { key: "", label: "전체" },
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
];

const resultOptions: ReadonlyArray<{ value: ReviewItemResult; label: string }> = [
  { value: "pass", label: "합격" },
  { value: "fail", label: "불합격" },
  { value: "na", label: "N/A" },
];

function formatNumericDisplay(value: number) {
  return value.toLocaleString("ko-KR");
}

function parseNumericInput(value: string) {
  const normalized = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!normalized) {
    return 0;
  }

  const [integerPart, ...decimalParts] = normalized.split(".");
  const decimalPart = decimalParts.join("");
  const numericValue = decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
  const parsed = Number(numericValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createDefaultForm(): ReviewFormState {
  return {
    contractorName: "",
    workType: "",
    contractAmount: 0,
    remarks: "",
  };
}

function createDefaultItems(): ReviewItem[] {
  return [{ checkItem: "", result: "pass", remarks: "" }];
}

function toFormState(detail: ReviewDetail): ReviewFormState {
  return {
    contractorName: detail.contractorName ?? "",
    workType: detail.workType ?? "",
    contractAmount: Number(detail.contractAmount ?? 0),
    remarks: detail.remarks ?? "",
  };
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusToneClass[status]}`}
    >
      {statusLabel[status]}
    </span>
  );
}

function ReviewFormFields({
  form,
  workTypeOptions,
  isLoadingWorkTypeOptions = false,
  disabled = false,
  onChange,
}: ReviewFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">업체명 *</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.contractorName}
          disabled={disabled}
          onChange={(event) => onChange({ contractorName: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">공종</label>
        {disabled ? (
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            value={form.workType}
            disabled
            readOnly
          />
        ) : (
          <>
            <select
              className="h-9 w-full rounded-md border border-border px-3 text-sm"
              value={form.workType}
              onChange={(event) => onChange({ workType: event.target.value })}
              disabled={isLoadingWorkTypeOptions}
            >
              <option value="">
                {isLoadingWorkTypeOptions ? "공종 불러오는 중..." : "공종 선택"}
              </option>
              {workTypeOptions.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
            {workTypeOptions.length === 0 && !isLoadingWorkTypeOptions ? (
              <p className="text-xs text-foreground-muted">
                <Link
                  href="/system-admin/codes/work-types"
                  className="underline underline-offset-2"
                >
                  공종 코드관리
                </Link>
                에서 먼저 등록할 수 있습니다.
              </p>
            ) : null}
          </>
        )}
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">계약금액</label>
        <input
          inputMode="numeric"
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={formatNumericDisplay(form.contractAmount)}
          disabled={disabled}
          onChange={(event) => onChange({ contractAmount: parseNumericInput(event.target.value) })}
        />
      </div>
      <div className="space-y-1 md:col-span-3">
        <label className="block text-sm font-medium text-foreground">비고</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.remarks}
          disabled={disabled}
          onChange={(event) => onChange({ remarks: event.target.value })}
        />
      </div>
    </div>
  );
}

function ReviewItemsFields({
  items,
  disabled = false,
  onChangeItem,
  onAddItem,
  onRemoveItem,
}: ReviewItemsFieldsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">검토항목</h2>
        {!disabled ? (
          <button type="button" onClick={onAddItem} className="text-sm text-primary hover:underline">
            + 항목추가
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background-soft px-3 py-4 text-sm text-foreground-muted">
          등록된 검토항목이 없습니다.
        </div>
      ) : (
        items.map((item, index) => (
          <div key={`${item.checkItem}-${index}`} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="block text-xs text-foreground-muted">점검항목</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={item.checkItem}
                disabled={disabled}
                onChange={(event) => onChangeItem(index, "checkItem", event.target.value)}
              />
            </div>
            <div className="w-24 space-y-1">
              <label className="block text-xs text-foreground-muted">결과</label>
              <select
                className="h-9 w-full rounded-md border border-border px-2 text-sm"
                value={item.result}
                disabled={disabled}
                onChange={(event) => onChangeItem(index, "result", event.target.value)}
              >
                {resultOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-xs text-foreground-muted">비고</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={item.remarks}
                disabled={disabled}
                onChange={(event) => onChangeItem(index, "remarks", event.target.value)}
              />
            </div>
            {!disabled ? (
              <button
                type="button"
                onClick={() => onRemoveItem(index)}
                className="h-9 px-2 text-sm text-red-500 hover:text-red-700"
              >
                삭제
              </button>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}

export default function SubcontractPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManageStatus = hasMinRole(user.role, "manager");

  const [data, setData] = useState<ReviewRow[]>([]);
  const [workTypeOptions, setWorkTypeOptions] = useState<WorkTypeOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | ReviewStatus>("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWorkTypeOptions, setIsLoadingWorkTypeOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [form, setForm] = useState<ReviewFormState>(createDefaultForm);
  const [items, setItems] = useState<ReviewItem[]>(createDefaultItems);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<ReviewDetail | null>(null);
  const [detailForm, setDetailForm] = useState<ReviewFormState>(createDefaultForm);
  const [detailItems, setDetailItems] = useState<ReviewItem[]>([]);
  const [detailMode, setDetailMode] = useState<DetailMode>("view");
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = useCallback(async (nextPage: number, nextStatus: "" | ReviewStatus) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setData([]);
      setTotalPages(1);
      return;
    }

    setIsLoading(true);
    try {
      const url = `/api/subcontract-reviews?siteId=${siteId}&page=${nextPage}${
        nextStatus ? `&status=${nextStatus}` : ""
      }`;
      const response = await fetch(url, { cache: "no-store" });
      const result = (await response.json()) as {
        ok: boolean;
        data?: ReviewRow[];
        meta?: { totalPages?: number };
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "협력사 검토요청 조회 실패");
      }

      setData(result.data ?? []);
      setTotalPages(result.meta?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "협력사 검토요청 조회 실패");
      setData([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchWorkTypeOptions = useCallback(async () => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setWorkTypeOptions([]);
      return;
    }

    setIsLoadingWorkTypeOptions(true);
    try {
      const response = await fetch(`/api/subcontract-reviews/work-type-options?siteId=${siteId}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: WorkTypeOption[];
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "공종 옵션을 불러오지 못했습니다.");
      }

      setWorkTypeOptions(result.data ?? []);
    } catch {
      setWorkTypeOptions([]);
    } finally {
      setIsLoadingWorkTypeOptions(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(page, statusFilter);
  }, [fetchData, page, statusFilter]);

  useEffect(() => {
    if (showForm || detailOpen) {
      void fetchWorkTypeOptions();
    }
  }, [detailOpen, fetchWorkTypeOptions, showForm]);

  function handleTabChange(key: "" | ReviewStatus) {
    setStatusFilter(key);
    setPage(1);
  }

  function addItem() {
    setItems((prev) => [...prev, { checkItem: "", result: "pass", remarks: "" }]);
  }

  function updateItem(index: number, field: keyof ReviewItem, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function removeItem(index: number) {
    if (items.length <= 1) {
      return;
    }
    setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function addDetailItem() {
    setDetailItems((prev) => [...prev, { checkItem: "", result: "pass", remarks: "" }]);
  }

  function updateDetailItem(index: number, field: keyof ReviewItem, value: string) {
    setDetailItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function removeDetailItem(index: number) {
    setDetailItems((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/subcontract-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, siteId, items }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "검토요청을 등록하지 못했습니다.");
      }

      setShowForm(false);
      setForm(createDefaultForm());
      setItems(createDefaultItems());
      setMessage("검토요청이 등록되었습니다.");
      setPage(1);
      await fetchData(1, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검토요청을 등록하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOpenDetail(row: ReviewRow) {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장을 먼저 선택해 주세요.");
      return;
    }

    setDetailOpen(true);
    setDetailMode("view");
    setDetailTarget(null);
    setDetailForm(createDefaultForm());
    setDetailItems([]);
    setIsLoadingDetail(true);
    setShowForm(false);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/subcontract-reviews/${row._id}?siteId=${siteId}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: ReviewDetail;
        error?: string;
      };
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "협력사 검토요청 상세를 불러오지 못했습니다.");
      }

      setDetailTarget(result.data);
      setDetailForm(toFormState(result.data));
      setDetailItems(result.data.items ?? []);
    } catch (err) {
      setDetailOpen(false);
      setError(err instanceof Error ? err.message : "협력사 검토요청 상세를 불러오지 못했습니다.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function handleCloseDetailModal() {
    if (isLoadingDetail || isUpdating) {
      return;
    }
    setDetailOpen(false);
    setDetailTarget(null);
    setDetailForm(createDefaultForm());
    setDetailItems([]);
    setDetailMode("view");
  }

  function handleEnterEditMode() {
    if (!detailTarget || detailTarget.status === "approved") {
      return;
    }

    setDetailForm(toFormState(detailTarget));
    setDetailItems(detailTarget.items.length > 0 ? detailTarget.items : createDefaultItems());
    setDetailMode("edit");
  }

  function handleCancelEditMode() {
    if (!detailTarget || isUpdating) {
      return;
    }

    setDetailForm(toFormState(detailTarget));
    setDetailItems(detailTarget.items ?? []);
    setDetailMode("view");
  }

  async function handleUpdate() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId || !detailTarget) {
      setError("현장 또는 수정 대상 정보를 확인할 수 없습니다.");
      return;
    }

    const previousStatus = detailTarget.status;

    setIsUpdating(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/subcontract-reviews/${detailTarget._id}?siteId=${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...detailForm, items: detailItems }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: ReviewDetail;
        error?: string;
      };
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "협력사 검토요청 수정 실패");
      }

      setDetailTarget(result.data);
      setDetailForm(toFormState(result.data));
      setDetailItems(result.data.items ?? []);
      setDetailMode("view");
      setMessage(
        previousStatus !== "pending" && result.data.status === "pending"
          ? "협력사 검토요청이 수정되었으며 상태가 대기로 변경되었습니다."
          : "협력사 검토요청이 수정되었습니다.",
      );
      await fetchData(page, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "협력사 검토요청 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleOpenDeleteModal(item: DeleteTarget) {
    setDeleteTarget(item);
    setError(null);
    setMessage(null);
  }

  function handleRequestDeleteFromDetail() {
    if (!detailTarget) {
      return;
    }

    handleOpenDeleteModal({
      _id: detailTarget._id,
      contractorName: detailTarget.contractorName,
      workType: detailTarget.workType,
      contractAmount: detailTarget.contractAmount,
    });
    handleCloseDetailModal();
  }

  function handleCloseDeleteModal() {
    if (deletingId) {
      return;
    }
    setDeleteTarget(null);
  }

  async function handleDelete() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId || !deleteTarget) {
      setError("현장 또는 삭제 대상 정보를 확인할 수 없습니다.");
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/subcontract-reviews/${deleteTarget._id}?siteId=${siteId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "협력사 검토요청 삭제 실패");
      }

      setDeleteTarget(null);
      setMessage("협력사 검토요청이 삭제되었습니다.");
      const nextPage = data.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage === page) {
        await fetchData(nextPage, statusFilter);
      } else {
        setPage(nextPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "협력사 검토요청 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  async function updateStatus(itemId: string, status: ReviewStatus, nextRejectionReason = "") {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return false;
    }

    setStatusUpdatingId(itemId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/subcontract-reviews/${itemId}?siteId=${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          rejectionReason: nextRejectionReason,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "협력사 검토요청 상태 변경 실패");
      }

      setMessage(
        status === "approved"
          ? "협력사 검토요청이 승인되었습니다."
          : status === "rejected"
            ? "협력사 검토요청이 반려되었습니다."
            : "협력사 검토요청이 대기 상태로 변경되었습니다.",
      );
      await fetchData(page, statusFilter);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "협력사 검토요청 상태 변경 실패");
      return false;
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function handleOpenApproveModal(item: ReviewRow) {
    setConfirmTarget({
      _id: item._id,
      contractorName: item.contractorName,
      workType: item.workType,
      contractAmount: item.contractAmount,
      nextStatus: "approved",
    });
    setError(null);
    setMessage(null);
  }

  function handleOpenResetApprovalModal(item: ReviewRow) {
    setConfirmTarget({
      _id: item._id,
      contractorName: item.contractorName,
      workType: item.workType,
      contractAmount: item.contractAmount,
      nextStatus: "pending",
    });
    setError(null);
    setMessage(null);
  }

  function handleCloseConfirmModal() {
    if (statusUpdatingId) {
      return;
    }
    setConfirmTarget(null);
  }

  async function handleConfirmSubmit() {
    if (!confirmTarget) {
      return;
    }

    const isUpdated = await updateStatus(confirmTarget._id, confirmTarget.nextStatus);
    if (isUpdated) {
      handleCloseConfirmModal();
    }
  }

  function handleOpenRejectModal(item: ReviewRow) {
    setRejectTarget({
      _id: item._id,
      contractorName: item.contractorName,
      workType: item.workType,
      contractAmount: item.contractAmount,
      rejectionReason: item.rejectionReason,
    });
    setRejectionReason(item.rejectionReason ?? "");
    setError(null);
    setMessage(null);
  }

  function handleCloseRejectModal() {
    if (statusUpdatingId) {
      return;
    }
    setRejectTarget(null);
    setRejectionReason("");
  }

  async function handleRejectSubmit() {
    if (!rejectTarget) {
      return;
    }

    const isUpdated = await updateStatus(rejectTarget._id, "rejected", rejectionReason);
    if (isUpdated) {
      handleCloseRejectModal();
    }
  }

  const columns: DataTableColumn<ReviewRow>[] = [
    { key: "contractorName", header: "업체명" },
    { key: "workType", header: "공종" },
    {
      key: "contractAmount",
      header: "계약금액",
      className: "w-32 text-right",
      render: (_value, row) => formatNumericDisplay(row.contractAmount ?? 0),
    },
    {
      key: "status",
      header: "상태",
      className: "w-24",
      render: (_value, row) => <StatusBadge status={row.status} />,
    },
    {
      key: "requestDate",
      header: "요청일",
      className: "w-28",
      render: (_value, row) => row.requestDate?.slice(0, 10) ?? "-",
    },
    {
      key: "approvedDate",
      header: "승인일",
      className: "w-28",
      render: (_value, row) => row.approvedDate?.slice(0, 10) ?? "-",
    },
    {
      key: "_id",
      header: "관리",
      className: "w-36",
      render: (_value, row) => {
        if (!canManageStatus) {
          return "-";
        }

        const isUpdating = statusUpdatingId === row._id;
        if (row.status === "pending") {
          return (
            <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => handleOpenApproveModal(row)}
                disabled={isUpdating}
                className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              >
                승인
              </button>
              <button
                type="button"
                onClick={() => handleOpenRejectModal(row)}
                disabled={isUpdating}
                className="rounded border border-danger/40 bg-danger/10 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/15 disabled:opacity-60"
              >
                반려
              </button>
            </div>
          );
        }

        if (row.status === "approved") {
          return (
            <div onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => handleOpenResetApprovalModal(row)}
                disabled={isUpdating}
                className="rounded border border-border bg-background-soft px-2 py-1 text-xs font-medium text-foreground hover:bg-background-card disabled:opacity-60"
              >
                승인 취소
              </button>
            </div>
          );
        }

        return "-";
      },
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">협력사 관리</h1>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "검토요청"}
        </button>
      </div>

      {showForm ? (
        <div className="rounded-lg border border-border bg-background-card p-4 space-y-4">
          <ReviewFormFields
            form={form}
            workTypeOptions={workTypeOptions}
            isLoadingWorkTypeOptions={isLoadingWorkTypeOptions}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />
          <ReviewItemsFields
            items={items}
            onChangeItem={updateItem}
            onAddItem={addItem}
            onRemoveItem={removeItem}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-6 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : "검토요청 등록"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!isUserLoading && !canManageStatus ? (
        <p className="text-sm text-foreground-muted">상태 처리는 `manager` 이상 권한에서 가능합니다.</p>
      ) : null}

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={`rounded-md px-4 py-1.5 text-sm transition-colors ${
              statusFilter === tab.key
                ? "bg-[#ecebe8] font-medium text-foreground"
                : "text-foreground-muted hover:bg-background-soft"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-background-card px-3 py-8 text-center text-sm text-foreground-muted shadow-[var(--shadow-soft)]">
          협력사 검토요청을 불러오는 중...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          rowKey={(row) => row._id}
          emptyMessage="등록된 협력사 검토요청이 없습니다."
          onRowClick={(row) => void handleOpenDetail(row)}
          getRowAriaLabel={(row) => `${row.contractorName} 협력사 검토요청 상세 보기`}
        />
      )}

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal
        open={detailOpen}
        title={detailMode === "edit" ? "협력사 검토요청 수정" : "협력사 검토요청 상세"}
        onClose={handleCloseDetailModal}
      >
        <div className="space-y-4">
          {isLoadingDetail ? (
            <div className="rounded-md border border-border bg-background-soft px-3 py-8 text-center text-sm text-foreground-muted">
              협력사 검토요청 상세를 불러오는 중...
            </div>
          ) : detailTarget ? (
            <>
              <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-background-soft p-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-foreground-muted">상태</p>
                  <div className="mt-1">
                    <StatusBadge status={detailTarget.status} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">요청일</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {detailTarget.requestDate?.slice(0, 10) ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted">승인일</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {detailTarget.approvedDate?.slice(0, 10) ?? "-"}
                  </p>
                </div>
                {detailTarget.rejectionReason ? (
                  <div className="md:col-span-3">
                    <p className="text-xs text-foreground-muted">반려 사유</p>
                    <p className="mt-1 text-sm text-foreground">{detailTarget.rejectionReason}</p>
                  </div>
                ) : null}
              </div>

              {detailMode === "edit" && detailTarget.status !== "pending" ? (
                <p className="text-xs text-foreground-muted">
                  수정 후 저장하면 상태가 대기로 변경됩니다.
                </p>
              ) : null}
              {detailMode === "view" && detailTarget.status === "approved" ? (
                <p className="text-xs text-foreground-muted">
                  승인 상태에서는 수정할 수 없습니다. 승인 취소 후 다시 수정해 주세요.
                </p>
              ) : null}

              <ReviewFormFields
                form={detailForm}
                workTypeOptions={workTypeOptions}
                isLoadingWorkTypeOptions={isLoadingWorkTypeOptions}
                disabled={detailMode === "view"}
                onChange={(patch) => setDetailForm((prev) => ({ ...prev, ...patch }))}
              />

              <ReviewItemsFields
                items={detailItems}
                disabled={detailMode === "view"}
                onChangeItem={updateDetailItem}
                onAddItem={addDetailItem}
                onRemoveItem={removeDetailItem}
              />

              <div className="flex justify-end gap-2">
                {detailMode === "view" ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCloseDetailModal}
                      className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                    >
                      닫기
                    </button>
                    {canManageStatus ? (
                      <>
                        {detailTarget.status !== "approved" ? (
                          <button
                            type="button"
                            onClick={handleEnterEditMode}
                            className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                          >
                            수정
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleRequestDeleteFromDetail}
                          className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/15"
                        >
                          삭제
                        </button>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelEditMode}
                      disabled={isUpdating}
                      className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUpdate()}
                      disabled={isUpdating}
                      className="rounded-md bg-[#ecebe8] px-4 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
                    >
                      {isUpdating ? "저장 중..." : "저장"}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="협력사 검토요청 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-background-soft p-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">{deleteTarget?.contractorName}</span>
              {deleteTarget?.workType ? ` / ${deleteTarget.workType}` : ""}
              {deleteTarget ? ` / ${formatNumericDisplay(deleteTarget.contractAmount)}원` : ""}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              삭제 후에는 협력사 검토요청과 검토항목에서 제외됩니다.
            </p>
          </div>
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
              className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/15 disabled:opacity-60"
            >
              {deletingId === deleteTarget?._id ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmTarget)}
        title={confirmTarget?.nextStatus === "pending" ? "협력사 승인 취소" : "협력사 승인"}
        onClose={handleCloseConfirmModal}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-foreground">
              <span className="font-medium">{confirmTarget?.contractorName}</span>
              {confirmTarget?.workType ? ` / ${confirmTarget.workType}` : ""}
              {confirmTarget ? ` / ${formatNumericDisplay(confirmTarget.contractAmount)}원` : ""}
            </p>
            <p className="text-sm text-foreground-muted">
              {confirmTarget
                ? confirmTarget.nextStatus === "pending"
                  ? "협력사 승인 상태를 대기로 되돌립니다."
                  : "협력사 검토요청을 승인합니다."
                : ""}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseConfirmModal}
              disabled={Boolean(statusUpdatingId)}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmSubmit()}
              disabled={Boolean(statusUpdatingId)}
              className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                confirmTarget?.nextStatus === "pending"
                  ? "border border-border bg-background-soft text-foreground hover:bg-background-card"
                  : "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {statusUpdatingId === confirmTarget?._id
                ? confirmTarget?.nextStatus === "pending"
                  ? "변경 중..."
                  : "승인 중..."
                : confirmTarget?.nextStatus === "pending"
                  ? "승인 취소"
                  : "승인"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(rejectTarget)} title="협력사 반려" onClose={handleCloseRejectModal}>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-foreground">
              <span className="font-medium">{rejectTarget?.contractorName}</span>
              {rejectTarget?.workType ? ` / ${rejectTarget.workType}` : ""}
              {rejectTarget ? ` / ${formatNumericDisplay(rejectTarget.contractAmount)}원` : ""}
            </p>
            <p className="text-sm text-foreground-muted">협력사 검토요청을 반려합니다.</p>
          </div>

          <label className="block space-y-1">
            <span className="block text-sm font-medium text-foreground">반려 사유</span>
            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="반려 사유를 입력해 주세요."
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseRejectModal}
              disabled={Boolean(statusUpdatingId)}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleRejectSubmit()}
              disabled={Boolean(statusUpdatingId)}
              className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/15 disabled:opacity-60"
            >
              {statusUpdatingId === rejectTarget?._id ? "반려 처리 중..." : "반려"}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
