"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import {
  DEFAULT_EQUIPMENT_UNIT,
  EQUIPMENT_UNIT_OPTIONS,
  type EquipmentUnit,
} from "@/lib/equipment-unit";

type ApprovedCompanyOption = {
  id: string;
  name: string;
};

type EquipmentRow = {
  _id: string;
  equipmentName: string;
  specification: string;
  unit: string;
  planQty: number;
  actualQty: number;
  planDate: string;
  actualDate: string;
  rentalCompany: string;
  unitPrice: number;
};

type EquipmentFormState = {
  equipmentName: string;
  specification: string;
  unit: EquipmentUnit;
  planQty: number;
  actualQty: number;
  planDate: string;
  actualDate: string;
  rentalCompany: string;
  unitPrice: number;
};

type DeleteTarget = {
  _id: string;
  equipmentName: string;
  specification: string;
};

type DetailMode = "view" | "edit";

const SITE_ID_KEY = "pmis:siteId";

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

function createDefaultForm(): EquipmentFormState {
  return {
    equipmentName: "",
    specification: "",
    unit: DEFAULT_EQUIPMENT_UNIT,
    planQty: 0,
    actualQty: 0,
    planDate: "",
    actualDate: "",
    rentalCompany: "",
    unitPrice: 0,
  };
}

function toFormState(row: EquipmentRow): EquipmentFormState {
  return {
    equipmentName: row.equipmentName ?? "",
    specification: row.specification ?? "",
    unit: (row.unit as EquipmentUnit) || DEFAULT_EQUIPMENT_UNIT,
    planQty: Number(row.planQty ?? 0),
    actualQty: Number(row.actualQty ?? 0),
    planDate: row.planDate ? String(row.planDate).slice(0, 10) : "",
    actualDate: row.actualDate ? String(row.actualDate).slice(0, 10) : "",
    rentalCompany: row.rentalCompany ?? "",
    unitPrice: Number(row.unitPrice ?? 0),
  };
}

const baseColumns: DataTableColumn<EquipmentRow>[] = [
  { key: "equipmentName", header: "장비명" },
  { key: "specification", header: "규격" },
  { key: "unit", header: "단위", className: "w-16" },
  {
    key: "planQty",
    header: "계획수량",
    className: "w-24 text-right",
    render: (_value, row) => formatNumericDisplay(row.planQty ?? 0),
  },
  {
    key: "actualQty",
    header: "실적수량",
    className: "w-24 text-right",
    render: (_value, row) => formatNumericDisplay(row.actualQty ?? 0),
  },
  {
    key: "unitPrice",
    header: "단가",
    className: "w-28 text-right",
    render: (_value, row) => formatNumericDisplay(row.unitPrice ?? 0),
  },
  { key: "rentalCompany", header: "임대업체" },
  {
    key: "planDate",
    header: "투입 예정일",
    className: "w-28",
    render: (_value, row) => row.planDate?.slice(0, 10),
  },
  {
    key: "actualDate",
    header: "실제 투입일",
    className: "w-28",
    render: (_value, row) => row.actualDate?.slice(0, 10),
  },
];

type EquipmentFormFieldsProps = {
  form: EquipmentFormState;
  onChange: (patch: Partial<EquipmentFormState>) => void;
  rentalCompanyOptions: ApprovedCompanyOption[];
  isLoadingRentalCompanyOptions?: boolean;
  disabled?: boolean;
};

function getRentalCompanyOptionsWithCurrentValue(
  options: ApprovedCompanyOption[],
  currentValue: string,
): ApprovedCompanyOption[] {
  if (!currentValue || options.some((option) => option.name === currentValue)) {
    return options;
  }

  return [{ id: currentValue, name: currentValue }, ...options];
}

function EquipmentFormFields({
  form,
  onChange,
  rentalCompanyOptions,
  isLoadingRentalCompanyOptions = false,
  disabled = false,
}: EquipmentFormFieldsProps) {
  const rentalCompanyOptionsWithCurrentValue = getRentalCompanyOptionsWithCurrentValue(
    rentalCompanyOptions,
    form.rentalCompany,
  );
  const isLegacyRentalCompany =
    Boolean(form.rentalCompany) &&
    !rentalCompanyOptions.some((option) => option.name === form.rentalCompany);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">장비명 *</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.equipmentName}
          disabled={disabled}
          onChange={(event) => onChange({ equipmentName: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">규격</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.specification}
          disabled={disabled}
          onChange={(event) => onChange({ specification: event.target.value })}
          placeholder="예: 25톤"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">단위</label>
        <select
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.unit}
          disabled={disabled}
          onChange={(event) => onChange({ unit: event.target.value as EquipmentUnit })}
        >
          {EQUIPMENT_UNIT_OPTIONS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">계획수량</label>
        <input
          inputMode="decimal"
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={formatNumericDisplay(form.planQty)}
          disabled={disabled}
          onChange={(event) => onChange({ planQty: parseNumericInput(event.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">실적수량</label>
        <input
          inputMode="decimal"
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={formatNumericDisplay(form.actualQty)}
          disabled={disabled}
          onChange={(event) => onChange({ actualQty: parseNumericInput(event.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">단가</label>
        <input
          inputMode="numeric"
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={formatNumericDisplay(form.unitPrice)}
          disabled={disabled}
          onChange={(event) => onChange({ unitPrice: parseNumericInput(event.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">임대업체</label>
        {disabled ? (
          <input
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
            value={form.rentalCompany}
            disabled
            readOnly
          />
        ) : (
          <>
            <select
              className="h-9 w-full rounded-md border border-border px-3 text-sm"
              value={form.rentalCompany}
              onChange={(event) => onChange({ rentalCompany: event.target.value })}
              disabled={isLoadingRentalCompanyOptions}
            >
              <option value="">
                {isLoadingRentalCompanyOptions
                  ? "업체 불러오는 중..."
                  : rentalCompanyOptions.length > 0
                    ? "임대업체 선택"
                    : "승인된 임대업체 없음"}
              </option>
              {rentalCompanyOptionsWithCurrentValue.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-foreground-muted">
              {rentalCompanyOptions.length > 0
                ? "업체 승인에서 승인 완료된 임대업체만 선택할 수 있습니다."
                : "업체 승인에서 장비 업체를 먼저 승인해 주세요."}
            </p>
            {isLegacyRentalCompany ? (
              <p className="text-xs text-danger">
                현재 저장된 업체는 승인 목록에 없습니다. 승인된 임대업체로 다시 선택해 주세요.
              </p>
            ) : null}
          </>
        )}
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">투입 예정일</label>
        <input
          type="date"
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.planDate}
          disabled={disabled}
          onChange={(event) => onChange({ planDate: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">실제 투입일</label>
        <input
          type="date"
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.actualDate}
          disabled={disabled}
          onChange={(event) => onChange({ actualDate: event.target.value })}
        />
      </div>
    </div>
  );
}

export default function EquipmentPlanActualPage() {
  const [data, setData] = useState<EquipmentRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EquipmentFormState>(createDefaultForm);
  const [rentalCompanyOptions, setRentalCompanyOptions] = useState<ApprovedCompanyOption[]>([]);
  const [isLoadingRentalCompanyOptions, setIsLoadingRentalCompanyOptions] = useState(false);
  const [detailTarget, setDetailTarget] = useState<EquipmentRow | null>(null);
  const [detailForm, setDetailForm] = useState<EquipmentFormState>(createDefaultForm);
  const [detailMode, setDetailMode] = useState<DetailMode>("view");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback(async (nextPage: number) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setData([]);
      setTotalPages(1);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/resource/equipment?siteId=${siteId}&page=${nextPage}`);
      const result = (await response.json()) as {
        ok: boolean;
        data?: EquipmentRow[];
        meta?: { totalPages?: number };
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "장비 현황 조회 실패");
      }
      setData(result.data ?? []);
      setTotalPages(result.meta?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "장비 현황 조회 실패");
      setData([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(page);
  }, [page, fetchData]);

  const fetchRentalCompanyOptions = useCallback(async () => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setRentalCompanyOptions([]);
      return;
    }

    setIsLoadingRentalCompanyOptions(true);
    try {
      const response = await fetch(
        `/api/resource/supplier-approvals/company-options?siteId=${siteId}&approvalType=equipment`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        ok: boolean;
        data?: ApprovedCompanyOption[];
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "임대업체 목록 조회 실패");
      }
      setRentalCompanyOptions(result.data ?? []);
    } catch {
      setRentalCompanyOptions([]);
    } finally {
      setIsLoadingRentalCompanyOptions(false);
    }
  }, []);

  useEffect(() => {
    void fetchRentalCompanyOptions();
  }, [fetchRentalCompanyOptions]);

  useEffect(() => {
    if (showForm || detailTarget) {
      void fetchRentalCompanyOptions();
    }
  }, [detailTarget, fetchRentalCompanyOptions, showForm]);

  async function handleCreate() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장을 선택한 뒤 다시 시도해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/resource/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, siteId }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "장비 항목 등록 실패");
      }

      setShowForm(false);
      setForm(createDefaultForm());
      setMessage("장비 항목이 등록되었습니다.");
      if (page === 1) {
        await fetchData(1);
      } else {
        setPage(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "장비 항목 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenDetail(row: EquipmentRow) {
    setDetailTarget(row);
    setDetailForm(toFormState(row));
    setDetailMode("view");
    setError(null);
    setMessage(null);
  }

  function handleCloseDetailModal() {
    if (isUpdating) {
      return;
    }
    setDetailTarget(null);
    setDetailForm(createDefaultForm());
    setDetailMode("view");
  }

  function handleEnterEditMode() {
    if (!detailTarget) {
      return;
    }
    setDetailForm(toFormState(detailTarget));
    setDetailMode("edit");
  }

  function handleCancelEditMode() {
    if (!detailTarget || isUpdating) {
      return;
    }
    setDetailForm(toFormState(detailTarget));
    setDetailMode("view");
  }

  async function handleUpdate() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId || !detailTarget) {
      setError("현장 또는 수정 대상 정보를 확인할 수 없습니다.");
      return;
    }

    setIsUpdating(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/resource/equipment/${detailTarget._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...detailForm, siteId }),
      });
      const result = (await response.json()) as { ok: boolean; data?: EquipmentRow; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "장비 항목 수정 실패");
      }

      if (result.data) {
        setDetailTarget(result.data);
        setDetailForm(toFormState(result.data));
      }
      setDetailMode("view");
      setMessage("장비 항목이 수정되었습니다.");
      await fetchData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "장비 항목 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleOpenDeleteModal(row: EquipmentRow) {
    setDeleteTarget({
      _id: row._id,
      equipmentName: row.equipmentName,
      specification: row.specification,
    });
    setError(null);
    setMessage(null);
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
      const response = await fetch(`/api/resource/equipment/${deleteTarget._id}?siteId=${siteId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "장비 항목 삭제 실패");
      }

      setDeleteTarget(null);
      if (detailTarget?._id === deleteTarget._id) {
        setDetailTarget(null);
        setDetailForm(createDefaultForm());
        setDetailMode("view");
      }
      setMessage("장비 항목이 삭제되었습니다.");
      const nextPage = data.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage === page) {
        await fetchData(nextPage);
      } else {
        setPage(nextPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "장비 항목 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  function handleRequestDeleteFromDetail() {
    if (!detailTarget) {
      return;
    }
    handleOpenDeleteModal(detailTarget);
    handleCloseDetailModal();
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">장비 현황</h1>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
        >
          {showForm ? "취소" : "등록"}
        </button>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <div className="space-y-3 rounded-lg border border-border bg-background-card p-4">
          <EquipmentFormFields
            form={form}
            rentalCompanyOptions={rentalCompanyOptions}
            isLoadingRentalCompanyOptions={isLoadingRentalCompanyOptions}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleCreate()}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
            >
              저장
            </button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-border bg-background-card px-3 py-8 text-center text-sm text-foreground-muted shadow-[var(--shadow-soft)]">
          장비 현황을 불러오는 중...
        </div>
      ) : (
        <DataTable
          columns={baseColumns}
          data={data}
          rowKey={(row) => row._id}
          onRowClick={(row) => handleOpenDetail(row)}
          getRowAriaLabel={(row) => `${row.equipmentName} 장비 항목 상세 보기`}
        />
      )}

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}

      <Modal
        open={Boolean(detailTarget)}
        title={detailMode === "edit" ? "장비 항목 수정" : "장비 항목 상세"}
        onClose={handleCloseDetailModal}
      >
        <div className="space-y-4">
          <EquipmentFormFields
            form={detailForm}
            rentalCompanyOptions={rentalCompanyOptions}
            isLoadingRentalCompanyOptions={isLoadingRentalCompanyOptions}
            disabled={detailMode === "view"}
            onChange={(patch) => setDetailForm((prev) => ({ ...prev, ...patch }))}
          />
          <div className="flex justify-end gap-2">
            {detailMode === "view" ? (
              <>
                <button
                  type="button"
                  onClick={handleCloseDetailModal}
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-background-soft"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleEnterEditMode}
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={handleRequestDeleteFromDetail}
                  className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/15"
                >
                  삭제
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleCancelEditMode}
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-background-soft disabled:opacity-60"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => void handleUpdate()}
                  className="rounded-md bg-[#ecebe8] px-3 py-2 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:opacity-60"
                >
                  저장
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(deleteTarget)} title="장비 항목 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-background-soft p-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">{deleteTarget?.equipmentName}</span>
              {deleteTarget?.specification ? ` · ${deleteTarget.specification}` : ""}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              삭제 후에는 장비 현황 목록과 원가 집계에서 제외됩니다.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={Boolean(deletingId)}
              onClick={handleCloseDeleteModal}
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              disabled={Boolean(deletingId)}
              onClick={() => void handleDelete()}
              className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/15 disabled:opacity-60"
            >
              삭제
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
