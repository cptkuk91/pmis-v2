"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";

type AttendanceRow = {
  _id: string;
  attendanceDate: string;
  workerName: string;
  company: string;
  jobType: string;
  workType: string;
  isPresent: boolean;
  hoursWorked: number;
  overtimeHours: number;
};

type WorkforceOption = {
  id: string;
  code: string;
  name: string;
  description: string;
};

type WorkforceOptionsResponse = {
  ok: boolean;
  data: {
    jobTypes: WorkforceOption[];
    workTypes: WorkforceOption[];
  };
  error?: string;
};

type AttendanceFormState = {
  attendanceDate: string;
  workerName: string;
  company: string;
  jobType: string;
  workType: string;
  isPresent: boolean;
  hoursWorked: number;
  overtimeHours: number;
};

type DeleteTarget = {
  _id: string;
  workerName: string;
  attendanceDate: string;
};

type DetailMode = "view" | "edit";

const SITE_ID_KEY = "pmis:siteId";

const columns: DataTableColumn<AttendanceRow>[] = [
  {
    key: "attendanceDate",
    header: "출역일",
    className: "w-28",
    render: (_value, row) => row.attendanceDate?.slice(0, 10),
  },
  { key: "workerName", header: "성명" },
  { key: "company", header: "소속" },
  { key: "jobType", header: "직종" },
  { key: "workType", header: "공종" },
  {
    key: "isPresent",
    header: "출석",
    className: "w-16",
    render: (_value, row) => (row.isPresent ? "O" : "X"),
  },
  { key: "hoursWorked", header: "근무시간", className: "w-24 text-right" },
  { key: "overtimeHours", header: "잔업", className: "w-20 text-right" },
];

function createDefaultForm(attendanceDate: string): AttendanceFormState {
  return {
    attendanceDate,
    workerName: "",
    company: "",
    jobType: "",
    workType: "",
    isPresent: true,
    hoursWorked: 8,
    overtimeHours: 0,
  };
}

function toFormState(row: AttendanceRow): AttendanceFormState {
  return {
    attendanceDate: row.attendanceDate ? String(row.attendanceDate).slice(0, 10) : "",
    workerName: row.workerName ?? "",
    company: row.company ?? "",
    jobType: row.jobType ?? "",
    workType: row.workType ?? "",
    isPresent: Boolean(row.isPresent),
    hoursWorked: Number(row.hoursWorked ?? 0),
    overtimeHours: Number(row.overtimeHours ?? 0),
  };
}

type WorkforceFormFieldsProps = {
  form: AttendanceFormState;
  onChange: (patch: Partial<AttendanceFormState>) => void;
  jobTypeOptions: WorkforceOption[];
  workTypeOptions: WorkforceOption[];
  isLoadingOptions?: boolean;
  disabled?: boolean;
};

function WorkforceFormFields({
  form,
  onChange,
  jobTypeOptions,
  workTypeOptions,
  isLoadingOptions = false,
  disabled = false,
}: WorkforceFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">출역일 *</label>
        <input
          type="date"
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.attendanceDate}
          disabled={disabled}
          onChange={(event) => onChange({ attendanceDate: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">성명 *</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.workerName}
          disabled={disabled}
          onChange={(event) => onChange({ workerName: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">소속</label>
        <input
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.company}
          disabled={disabled}
          onChange={(event) => onChange({ company: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">출석 여부</label>
        <select
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.isPresent ? "present" : "absent"}
          disabled={disabled}
          onChange={(event) => onChange({ isPresent: event.target.value === "present" })}
        >
          <option value="present">출석</option>
          <option value="absent">결근</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">직종</label>
        <select
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.jobType}
          disabled={disabled || isLoadingOptions}
          onChange={(event) => onChange({ jobType: event.target.value })}
        >
          <option value="">{isLoadingOptions ? "직종 불러오는 중..." : "직종 선택"}</option>
          {jobTypeOptions.map((option) => (
            <option key={option.id} value={option.name}>
              {option.name}
            </option>
          ))}
        </select>
        {!disabled && jobTypeOptions.length === 0 && !isLoadingOptions ? (
          <p className="text-xs text-foreground-muted">
            <Link href="/system-admin/codes/job-types" className="underline underline-offset-2">
              직종 코드관리
            </Link>
            에서 먼저 등록할 수 있습니다.
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">공종</label>
        <select
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.workType}
          disabled={disabled || isLoadingOptions}
          onChange={(event) => onChange({ workType: event.target.value })}
        >
          <option value="">{isLoadingOptions ? "공종 불러오는 중..." : "공종 선택"}</option>
          {workTypeOptions.map((option) => (
            <option key={option.id} value={option.name}>
              {option.name}
            </option>
          ))}
        </select>
        {!disabled && workTypeOptions.length === 0 && !isLoadingOptions ? (
          <p className="text-xs text-foreground-muted">
            <Link href="/system-admin/codes/work-types" className="underline underline-offset-2">
              공종 코드관리
            </Link>
            에서 먼저 등록할 수 있습니다.
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">근무시간</label>
        <input
          type="number"
          min={0}
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.hoursWorked}
          disabled={disabled}
          onChange={(event) => onChange({ hoursWorked: Number(event.target.value) })}
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">잔업시간</label>
        <input
          type="number"
          min={0}
          className="h-9 w-full rounded-md border border-border px-3 text-sm"
          value={form.overtimeHours}
          disabled={disabled}
          onChange={(event) => onChange({ overtimeHours: Number(event.target.value) })}
        />
      </div>
    </div>
  );
}

export default function WorkforceDailyPage() {
  const [data, setData] = useState<AttendanceRow[]>([]);
  const [jobTypeOptions, setJobTypeOptions] = useState<WorkforceOption[]>([]);
  const [workTypeOptions, setWorkTypeOptions] = useState<WorkforceOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AttendanceFormState>(() =>
    createDefaultForm(new Date().toISOString().slice(0, 10)),
  );
  const [detailTarget, setDetailTarget] = useState<AttendanceRow | null>(null);
  const [detailForm, setDetailForm] = useState<AttendanceFormState>(() =>
    createDefaultForm(new Date().toISOString().slice(0, 10)),
  );
  const [detailMode, setDetailMode] = useState<DetailMode>("view");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchData = useCallback(async (nextPage: number, nextDate: string) => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setData([]);
      setTotalPages(1);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/resource/workforce/daily?siteId=${siteId}&date=${nextDate}&page=${nextPage}&limit=50`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        ok: boolean;
        data: AttendanceRow[];
        meta?: { totalPages?: number };
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "일일 근태 조회 실패");
      }

      setData(result.data ?? []);
      setTotalPages(result.meta?.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "일일 근태 조회 실패");
      setData([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOptions = useCallback(async () => {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setJobTypeOptions([]);
      setWorkTypeOptions([]);
      return;
    }

    setIsLoadingOptions(true);
    try {
      const response = await fetch(`/api/resource/workforce/daily/options?siteId=${siteId}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as WorkforceOptionsResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "직종/공종 옵션을 불러오지 못했습니다.");
      }

      setJobTypeOptions(result.data.jobTypes ?? []);
      setWorkTypeOptions(result.data.workTypes ?? []);
    } catch {
      setJobTypeOptions([]);
      setWorkTypeOptions([]);
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(page, date);
  }, [page, date, fetchData]);

  useEffect(() => {
    if (showForm || detailTarget) {
      void fetchOptions();
    }
  }, [detailTarget, fetchOptions, showForm]);

  async function handleCreate() {
    const siteId = localStorage.getItem(SITE_ID_KEY) ?? "";
    if (!siteId) {
      setError("현장을 먼저 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/resource/workforce/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, siteId }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "일일 근태 등록 실패");
      }

      setShowForm(false);
      setForm(createDefaultForm(date));
      setMessage("일일 근태가 등록되었습니다.");
      if (page === 1) {
        await fetchData(1, date);
      } else {
        setPage(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "일일 근태 등록 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenCreateForm() {
    setError(null);
    setMessage(null);
    setForm(createDefaultForm(date));
    setShowForm((prev) => !prev);
  }

  function handleOpenDetail(row: AttendanceRow) {
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
    setDetailForm(createDefaultForm(date));
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
      const response = await fetch(`/api/resource/workforce/daily/${detailTarget._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...detailForm, siteId }),
      });
      const result = (await response.json()) as { ok: boolean; data?: AttendanceRow; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "일일 근태 수정 실패");
      }

      if (result.data) {
        setDetailTarget(result.data);
        setDetailForm(toFormState(result.data));
      }
      setDetailMode("view");
      setMessage("일일 근태가 수정되었습니다.");
      await fetchData(page, date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "일일 근태 수정 실패");
    } finally {
      setIsUpdating(false);
    }
  }

  function handleOpenDeleteModal(row: AttendanceRow) {
    setDeleteTarget({
      _id: row._id,
      workerName: row.workerName,
      attendanceDate: row.attendanceDate ? String(row.attendanceDate).slice(0, 10) : "",
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
      const response = await fetch(
        `/api/resource/workforce/daily/${deleteTarget._id}?siteId=${siteId}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "일일 근태 삭제 실패");
      }

      setDeleteTarget(null);
      if (detailTarget?._id === deleteTarget._id) {
        setDetailTarget(null);
        setDetailForm(createDefaultForm(date));
        setDetailMode("view");
      }
      setMessage("일일 근태가 삭제되었습니다.");
      const nextPage = data.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage === page) {
        await fetchData(nextPage, date);
      } else {
        setPage(nextPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "일일 근태 삭제 실패");
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
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-semibold text-foreground">일일 근태</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="h-9 rounded-md border border-border px-3 text-sm"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          />
          <button
            type="button"
            onClick={handleOpenCreateForm}
            className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db]"
          >
            {showForm ? "취소" : "등록"}
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {showForm ? (
        <div className="space-y-3 rounded-lg border border-border bg-background-card p-4">
          <WorkforceFormFields
            form={form}
            jobTypeOptions={jobTypeOptions}
            workTypeOptions={workTypeOptions}
            isLoadingOptions={isLoadingOptions}
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
          일일 근태를 불러오는 중...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          rowKey={(row) => row._id}
          onRowClick={(row) => handleOpenDetail(row)}
          getRowAriaLabel={(row) => `${row.workerName} 근태 상세 보기`}
        />
      )}

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}

      <Modal
        open={Boolean(detailTarget)}
        title={detailMode === "edit" ? "일일 근태 수정" : "일일 근태 상세"}
        onClose={handleCloseDetailModal}
      >
        <div className="space-y-4">
          <WorkforceFormFields
            form={detailForm}
            jobTypeOptions={jobTypeOptions}
            workTypeOptions={workTypeOptions}
            isLoadingOptions={isLoadingOptions}
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

      <Modal open={Boolean(deleteTarget)} title="일일 근태 삭제" onClose={handleCloseDeleteModal}>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-background-soft p-3">
            <p className="text-sm text-foreground">
              <span className="font-medium">{deleteTarget?.workerName}</span>
              {deleteTarget?.attendanceDate ? ` · ${deleteTarget.attendanceDate}` : ""}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              삭제 후에는 일일 근태 목록과 인력 집계에서 제외됩니다.
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
