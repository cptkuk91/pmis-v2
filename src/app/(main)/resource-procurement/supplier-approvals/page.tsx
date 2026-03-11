"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, Modal, Pagination } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import {
  DEFAULT_SUPPLIER_APPROVAL_STATUS,
  DEFAULT_SUPPLIER_APPROVAL_TYPE,
  SUPPLIER_APPROVAL_STATUS_LABEL,
  SUPPLIER_APPROVAL_TYPE_LABEL,
  SUPPLIER_APPROVAL_TYPE_OPTIONS,
  type SupplierApprovalStatus,
  type SupplierApprovalType,
} from "@/lib/supplier-approval";

type ApprovalRow = {
  _id: string;
  approvalType?: SupplierApprovalType;
  supplierName: string;
  materialName: string;
  specification: string;
  requestDate: string;
  status: SupplierApprovalStatus;
  approvedAt?: string;
  remarks: string;
  rejectionReason?: string;
};

type ApprovalFormState = {
  approvalType: SupplierApprovalType;
  supplierName: string;
  materialName: string;
  specification: string;
  requestDate: string;
  remarks: string;
};

type SpecificationOption = {
  id: string;
  code: string;
  name: string;
  description: string;
};

type RejectTarget = {
  _id: string;
  approvalType: SupplierApprovalType;
  supplierName: string;
  materialName: string;
  specification: string;
};

type ConfirmTarget = {
  _id: string;
  approvalType: SupplierApprovalType;
  supplierName: string;
  materialName: string;
  specification: string;
  nextStatus: "approved" | "pending";
};

const SITE_ID_KEY = "pmis:siteId";

const tabs: ReadonlyArray<{ key: "" | SupplierApprovalStatus; label: string }> = [
  { key: "", label: "전체" },
  { key: "approved", label: "승인" },
  { key: "pending", label: "대기" },
  { key: "rejected", label: "반려" },
];

const statusToneClass: Record<SupplierApprovalStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatKoreanDate(value: string) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return "";
  }

  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

function createDefaultForm(): ApprovalFormState {
  return {
    approvalType: DEFAULT_SUPPLIER_APPROVAL_TYPE,
    supplierName: "",
    materialName: "",
    specification: "",
    requestDate: getTodayDateInputValue(),
    remarks: "",
  };
}

function StatusBadge({ status }: { status: SupplierApprovalStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusToneClass[status]}`}
    >
      {SUPPLIER_APPROVAL_STATUS_LABEL[status]}
    </span>
  );
}

function getSpecificationCodeLink(approvalType: SupplierApprovalType) {
  return approvalType === "equipment"
    ? {
        href: "/system-admin/codes/equipment-specifications",
        label: "장비 규격 코드",
      }
    : {
        href: "/system-admin/codes/material-specifications",
        label: "자재 규격 코드",
      };
}

export default function SupplierApprovalsPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManageStatus = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);

  const [data, setData] = useState<ApprovalRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"" | SupplierApprovalStatus>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ApprovalFormState>(createDefaultForm);
  const [specificationOptions, setSpecificationOptions] = useState<SpecificationOption[]>([]);
  const [isLoadingSpecificationOptions, setIsLoadingSpecificationOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const specificationCodeLink = getSpecificationCodeLink(form.approvalType);

  const fetchData = useCallback(async (nextPage: number, nextStatus: "" | SupplierApprovalStatus) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      setData([]);
      setTotalPages(1);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        siteId,
        page: String(nextPage),
      });
      if (nextStatus) {
        params.set("status", nextStatus);
      }

      const response = await fetch(`/api/resource/supplier-approvals?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: ApprovalRow[];
        meta?: { totalPages?: number };
        error?: string;
      };

      if (!result.ok) {
        throw new Error(result.error ?? "업체 승인 요청 조회 실패");
      }

      setData(result.data ?? []);
      setTotalPages(result.meta?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업체 승인 요청 조회 실패");
      setData([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(page, statusFilter);
  }, [fetchData, page, statusFilter]);

  const fetchSpecificationOptions = useCallback(async (approvalType: SupplierApprovalType) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setSpecificationOptions([]);
      return;
    }

    setIsLoadingSpecificationOptions(true);
    try {
      const response = await fetch(
        `/api/resource/supplier-approvals/specification-options?siteId=${siteId}&approvalType=${approvalType}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        ok: boolean;
        data?: SpecificationOption[];
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "규격 코드 조회 실패");
      }
      setSpecificationOptions(result.data ?? []);
    } catch {
      setSpecificationOptions([]);
    } finally {
      setIsLoadingSpecificationOptions(false);
    }
  }, []);

  useEffect(() => {
    void fetchSpecificationOptions(form.approvalType);
  }, [fetchSpecificationOptions, form.approvalType]);

  function handleTabChange(key: "" | SupplierApprovalStatus) {
    setStatusFilter(key);
    setPage(1);
  }

  async function handleSubmit() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/resource/supplier-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, siteId }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "업체 승인 요청 등록 실패");
      }

      setShowForm(false);
      setForm(createDefaultForm());
      setPage(1);
      setMessage("업체 승인 요청이 등록되었습니다.");
      await fetchData(1, statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업체 승인 요청 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateStatus(
    itemId: string,
    status: SupplierApprovalStatus,
    nextRejectionReason = "",
  ) {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장 정보가 없습니다.");
      return false;
    }

    setStatusUpdatingId(itemId);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/resource/supplier-approvals/${itemId}?siteId=${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          rejectionReason: nextRejectionReason,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "업체 승인 상태 변경 실패");
      }

      setMessage(
        status === "approved"
          ? "업체 승인 요청이 승인되었습니다."
          : status === "rejected"
            ? "업체 승인 요청이 반려되었습니다."
            : "업체 승인 요청이 대기 상태로 변경되었습니다.",
      );
      await fetchData(page, statusFilter);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "업체 승인 상태 변경 실패");
      return false;
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function handleOpenApproveModal(item: ApprovalRow) {
    setConfirmTarget({
      _id: item._id,
      approvalType: item.approvalType ?? DEFAULT_SUPPLIER_APPROVAL_TYPE,
      supplierName: item.supplierName,
      materialName: item.materialName,
      specification: item.specification,
      nextStatus: "approved",
    });
    setError(null);
    setMessage(null);
  }

  function handleOpenResetApprovalModal(item: ApprovalRow) {
    setConfirmTarget({
      _id: item._id,
      approvalType: item.approvalType ?? DEFAULT_SUPPLIER_APPROVAL_TYPE,
      supplierName: item.supplierName,
      materialName: item.materialName,
      specification: item.specification,
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

  function handleOpenRejectModal(item: ApprovalRow) {
    setRejectTarget({
      _id: item._id,
      approvalType: item.approvalType ?? DEFAULT_SUPPLIER_APPROVAL_TYPE,
      supplierName: item.supplierName,
      materialName: item.materialName,
      specification: item.specification,
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

  const columns = useMemo<DataTableColumn<ApprovalRow>[]>(
    () => [
      {
        key: "approvalType",
        header: "구분",
        className: "w-20",
        render: (_value, row) =>
          SUPPLIER_APPROVAL_TYPE_LABEL[row.approvalType ?? DEFAULT_SUPPLIER_APPROVAL_TYPE],
      },
      { key: "supplierName", header: "공급업체" },
      { key: "materialName", header: "품목명" },
      { key: "specification", header: "규격" },
      {
        key: "requestDate",
        header: "요청일",
        className: "w-28",
        render: (_value, row) => row.requestDate?.slice(0, 10) ?? "-",
      },
      {
        key: "status",
        header: "상태",
        className: "w-24",
        render: (_value, row) => <StatusBadge status={row.status ?? DEFAULT_SUPPLIER_APPROVAL_STATUS} />,
      },
      {
        key: "approvedAt",
        header: "승인일",
        className: "w-28",
        render: (_value, row) => row.approvedAt?.slice(0, 10) ?? "-",
      },
      { key: "remarks", header: "비고" },
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
              <div className="flex items-center gap-2">
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
              <button
                type="button"
                onClick={() => handleOpenResetApprovalModal(row)}
                disabled={isUpdating}
                className="rounded border border-border bg-background-soft px-2 py-1 text-xs font-medium text-foreground hover:bg-background-card disabled:opacity-60"
              >
                승인 취소
              </button>
            );
          }

          if (row.status === "rejected") {
            return "-";
          }

          return (
            "-"
          );
        },
      },
    ],
    [canManageStatus, statusUpdatingId],
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">업체 승인</h1>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "요청등록"}
        </button>
      </div>

      {showForm ? (
        <div className="space-y-3 rounded-lg border border-border bg-background-card p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">구분 *</label>
              <select
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.approvalType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    approvalType: event.target.value as SupplierApprovalType,
                    specification: "",
                  }))
                }
              >
                {SUPPLIER_APPROVAL_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {SUPPLIER_APPROVAL_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">공급업체 *</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.supplierName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, supplierName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">
                {form.approvalType === "equipment" ? "장비명 *" : "자재명 *"}
              </label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.materialName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, materialName: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">규격</label>
              <select
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.specification}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, specification: event.target.value }))
                }
                disabled={isLoadingSpecificationOptions}
              >
                <option value="">
                  {isLoadingSpecificationOptions
                    ? "규격 불러오는 중..."
                    : specificationOptions.length > 0
                      ? "규격 선택"
                      : "설정된 규격 없음"}
                </option>
                {specificationOptions.map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-foreground-muted">
                {specificationOptions.length > 0
                  ? `${SUPPLIER_APPROVAL_TYPE_LABEL[form.approvalType]} 규격 코드에서 선택합니다.`
                  : (
                    <>
                      <Link
                        href={specificationCodeLink.href}
                        className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
                      >
                        {specificationCodeLink.label}
                      </Link>
                      를 시스템 관리에서 먼저 등록해 주세요.
                    </>
                  )}
              </p>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">요청일</label>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.requestDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, requestDate: event.target.value }))
                }
              />
              <p className="text-xs text-foreground-muted">{formatKoreanDate(form.requestDate)}</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-foreground">비고</label>
              <input
                className="h-9 w-full rounded-md border border-border px-3 text-sm"
                value={form.remarks}
                onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))}
              />
            </div>
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

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!isUserLoading && !canManageStatus ? (
        <p className="text-sm text-foreground-muted">상태 처리는 `manager` 이상 권한에서 가능합니다.</p>
      ) : null}

      <div className="flex gap-1 rounded-md border border-border bg-background-card p-1">
        {tabs.map((tab) => (
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

      <DataTable
        columns={columns}
        data={data}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "불러오는 중..." : "등록된 업체 승인 요청이 없습니다."}
      />
      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal
        open={Boolean(confirmTarget)}
        title={confirmTarget?.nextStatus === "pending" ? "업체 승인 취소" : "업체 승인"}
        onClose={handleCloseConfirmModal}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-foreground">
              <span className="font-medium">{confirmTarget?.supplierName}</span>
              {confirmTarget?.materialName ? ` / ${confirmTarget.materialName}` : ""}
              {confirmTarget?.specification ? ` / ${confirmTarget.specification}` : ""}
            </p>
            <p className="text-sm text-foreground-muted">
              {confirmTarget
                ? confirmTarget.nextStatus === "pending"
                  ? `${SUPPLIER_APPROVAL_TYPE_LABEL[confirmTarget.approvalType]} 승인 상태를 대기로 되돌립니다.`
                  : `${SUPPLIER_APPROVAL_TYPE_LABEL[confirmTarget.approvalType]} 승인 요청을 승인합니다.`
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

      <Modal open={Boolean(rejectTarget)} title="업체 승인 반려" onClose={handleCloseRejectModal}>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-foreground">
              <span className="font-medium">{rejectTarget?.supplierName}</span>
              {rejectTarget?.materialName ? ` / ${rejectTarget.materialName}` : ""}
              {rejectTarget?.specification ? ` / ${rejectTarget.specification}` : ""}
            </p>
            <p className="text-sm text-foreground-muted">
              {rejectTarget
                ? `${SUPPLIER_APPROVAL_TYPE_LABEL[rejectTarget.approvalType]} 승인 요청을 반려합니다.`
                : ""}
            </p>
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
