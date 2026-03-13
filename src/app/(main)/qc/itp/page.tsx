"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QcFeedbackBanners } from "@/components/qc/feedback-banners";
import { QcFilterPanel } from "@/components/qc/filter-panel";
import { QcSortSelect } from "@/components/qc/sort-select";
import { DataTable } from "@/components/ui/data-table";
import { FormInput } from "@/components/ui/form-input";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import type { DataTableColumn } from "@/components/ui/data-table";
import {
  formatSiteMemberSummary,
  useSiteMembers,
  type SiteMemberOption,
} from "@/hooks/use-site-members";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import {
  QC_ITP_HOLD_POINT_LABELS,
  QC_ITP_HOLD_POINT_VALUES,
  QC_ITP_ITEM_TYPE_LABELS,
  QC_ITP_ITEM_TYPE_VALUES,
  QC_ITP_STATUS_LABELS,
  QC_ITP_STATUS_VALUES,
  type QcItpHoldPoint,
  type QcItpItemType,
  type QcItpStatus,
} from "@/lib/qc-itp";

type WorkTypeOption = {
  id: string;
  code: string;
  name: string;
  description: string;
};

type QcItpCheckpointRow = {
  checkpointId: string;
  phaseName: string;
  checkpointTitle: string;
  checkpointType: QcItpItemType;
  holdPoint: QcItpHoldPoint;
  timing: string;
  frequency: string;
  acceptanceCriteria: string;
  referenceCode: string;
  ownerName: string;
  ownerMemberId: string;
};

type QcItpItem = {
  _id: string;
  year: number;
  versionNo: number;
  status: QcItpStatus;
  planTitle: string;
  workType: string;
  processStep: string;
  scopeSummary: string;
  revisionReason: string;
  referenceDrawingNo: string;
  referenceSpec: string;
  notes: string;
  checkpoints: QcItpCheckpointRow[];
  createdAt: string;
  updatedAt: string;
  actions?: string;
};

type QcItpForm = {
  year: string;
  versionNo: string;
  status: QcItpStatus;
  planTitle: string;
  workType: string;
  processStep: string;
  scopeSummary: string;
  revisionReason: string;
  referenceDrawingNo: string;
  referenceSpec: string;
  notes: string;
  checkpoints: QcItpCheckpointRow[];
};

type QcItpResponse = {
  ok: boolean;
  data: QcItpItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type DeleteTarget = Pick<QcItpItem, "_id" | "planTitle" | "year" | "versionNo">;
type QcItpSort = "year_desc" | "year_asc" | "title_asc" | "work_type_asc" | "updated_desc";

const SITE_ID_KEY = "pmis:siteId";
const QcItpSortOptions: Array<{ value: QcItpSort; label: string }> = [
  { value: "year_desc", label: "연도 최신순" },
  { value: "year_asc", label: "연도 오래된순" },
  { value: "title_asc", label: "ITP명순" },
  { value: "work_type_asc", label: "공종순" },
  { value: "updated_desc", label: "최근 수정순" },
];

function createCheckpointDraft(): QcItpCheckpointRow {
  const checkpointId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `qc-itp-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    checkpointId,
    phaseName: "",
    checkpointTitle: "",
    checkpointType: "inspection",
    holdPoint: "none",
    timing: "",
    frequency: "",
    acceptanceCriteria: "",
    referenceCode: "",
    ownerName: "",
    ownerMemberId: "",
  };
}

function createEmptyForm(): QcItpForm {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    versionNo: "1",
    status: "draft",
    planTitle: `${now.getFullYear()} 검사·시험 계획`,
    workType: "",
    processStep: "",
    scopeSummary: "",
    revisionReason: "",
    referenceDrawingNo: "",
    referenceSpec: "",
    notes: "",
    checkpoints: [createCheckpointDraft()],
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

function calculateCheckpointSummary(checkpoints: QcItpCheckpointRow[]) {
  const inspectionCount = checkpoints.filter((item) => item.checkpointType === "inspection").length;
  const testCount = checkpoints.filter((item) => item.checkpointType === "test").length;
  const holdCount = checkpoints.filter((item) => item.holdPoint === "hold").length;
  const witnessCount = checkpoints.filter((item) => item.holdPoint === "witness").length;

  return {
    inspectionCount,
    testCount,
    holdCount,
    witnessCount,
  };
}

function StatusPill({ status }: { status: QcItpStatus }) {
  const toneClass =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "archived"
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_ITP_STATUS_LABELS[status]}
    </span>
  );
}

function HoldPointPill({ holdPoint }: { holdPoint: QcItpHoldPoint }) {
  const toneClass =
    holdPoint === "hold"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : holdPoint === "witness"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QC_ITP_HOLD_POINT_LABELS[holdPoint]}
    </span>
  );
}

export default function QcItpPage() {
  const { user, isLoading: isUserLoading } = useCurrentUser();
  const canManage = useMemo(() => hasMinRole(user.role, "manager"), [user.role]);
  const {
    memberOptions,
    filteredMembers,
    memberQuery,
    setMemberQuery,
    isMemberLoading,
    memberError,
  } = useSiteMembers(canManage);

  const memberOptionById = useMemo(() => new Map(memberOptions.map((item) => [item._id, item])), [memberOptions]);

  const [items, setItems] = useState<QcItpItem[]>([]);
  const [workTypeOptions, setWorkTypeOptions] = useState<WorkTypeOption[]>([]);
  const [workTypeError, setWorkTypeError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QcItpStatus>("all");
  const [workTypeFilter, setWorkTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState<QcItpSort>("year_desc");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QcItpForm>(() => createEmptyForm());
  const [selectedItem, setSelectedItem] = useState<QcItpItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownerPickerCheckpointId, setOwnerPickerCheckpointId] = useState<string | null>(null);

  const loadWorkTypeOptions = useCallback(async () => {
    const siteId = readSiteId();
    if (!siteId) {
      setWorkTypeOptions([]);
      setWorkTypeError("현장을 먼저 선택해 주세요.");
      return;
    }

    try {
      setWorkTypeError(null);
      const response = await fetch(`/api/qc/itp/options?siteId=${siteId}`, { cache: "no-store" });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { workTypeOptions?: WorkTypeOption[] };
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "공종 옵션 조회 실패");
      }

      setWorkTypeOptions(Array.isArray(result.data?.workTypeOptions) ? result.data?.workTypeOptions : []);
    } catch (err) {
      setWorkTypeOptions([]);
      setWorkTypeError(err instanceof Error ? err.message : "공종 옵션 조회 실패");
    }
  }, []);

  const loadPlans = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          status: statusFilter,
          sort: sortBy,
        });
        if (yearFilter.trim()) {
          params.set("year", yearFilter.trim());
        }
        if (workTypeFilter.trim()) {
          params.set("workType", workTypeFilter.trim());
        }

        const response = await fetch(`/api/qc/itp?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as QcItpResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "ITP 조회 실패");
        }

        setItems(Array.isArray(result.data) ? result.data : []);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "ITP 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, sortBy, statusFilter, workTypeFilter, yearFilter],
  );

  useEffect(() => {
    void loadPlans(1);
  }, [loadPlans]);

  useEffect(() => {
    void loadWorkTypeOptions();
  }, [loadWorkTypeOptions]);

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setOwnerPickerCheckpointId(null);
    setMemberQuery("");
  }

  function applyItemToForm(item: QcItpItem) {
    setEditingId(item._id);
    setShowForm(true);
    setForm({
      year: String(item.year),
      versionNo: String(item.versionNo),
      status: item.status,
      planTitle: item.planTitle,
      workType: item.workType,
      processStep: item.processStep,
      scopeSummary: item.scopeSummary,
      revisionReason: item.revisionReason,
      referenceDrawingNo: item.referenceDrawingNo,
      referenceSpec: item.referenceSpec,
      notes: item.notes,
      checkpoints: item.checkpoints.map((checkpoint) => ({
        ...checkpoint,
      })),
    });
    setOwnerPickerCheckpointId(null);
    setMessage(null);
    setError(null);
  }

  function updateFormField<K extends keyof QcItpForm>(field: K, value: QcItpForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateCheckpointField<K extends keyof QcItpCheckpointRow>(
    checkpointId: string,
    field: K,
    value: QcItpCheckpointRow[K],
  ) {
    setForm((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.map((item) =>
        item.checkpointId === checkpointId ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function addCheckpoint() {
    setForm((prev) => ({
      ...prev,
      checkpoints: [...prev.checkpoints, createCheckpointDraft()],
    }));
  }

  function removeCheckpoint(checkpointId: string) {
    setForm((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.filter((item) => item.checkpointId !== checkpointId),
    }));
    if (ownerPickerCheckpointId === checkpointId) {
      setOwnerPickerCheckpointId(null);
    }
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
    if (user.userName) {
      setForm((prev) => ({
        ...prev,
        checkpoints: prev.checkpoints.map((checkpoint) => ({
          ...checkpoint,
          ownerName: checkpoint.ownerName || user.userName || "",
        })),
      }));
    }
  }

  function duplicateItem(item: QcItpItem) {
    setEditingId(null);
    setShowForm(true);
    setForm({
      year: String(item.year),
      versionNo: "1",
      status: "draft",
      planTitle: `${item.planTitle} 복제`,
      workType: item.workType,
      processStep: item.processStep,
      scopeSummary: item.scopeSummary,
      revisionReason: `기존 ITP(${item.year}년 Rev.${item.versionNo}) 기준 복제`,
      referenceDrawingNo: item.referenceDrawingNo,
      referenceSpec: item.referenceSpec,
      notes: item.notes,
      checkpoints: item.checkpoints.map((checkpoint) => ({
        ...checkpoint,
        checkpointId:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `qc-itp-copy-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      })),
    });
    setOwnerPickerCheckpointId(null);
    setMemberQuery("");
    setMessage("기존 ITP를 복제해 새 등록 폼으로 불러왔습니다.");
    setError(null);
  }

  function resetFilters() {
    setKeyword("");
    setYearFilter("");
    setStatusFilter("all");
    setWorkTypeFilter("");
    setSortBy("year_desc");
    setPage(1);
    void loadPlans(1);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const endpoint = editingId ? `/api/qc/itp/${editingId}` : "/api/qc/itp";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          versionNo: Number(form.versionNo),
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "ITP 저장 실패");
      }

      setMessage(editingId ? "ITP를 수정했습니다." : "ITP를 등록했습니다.");
      resetForm();
      setShowForm(false);
      await loadPlans(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ITP 저장 실패");
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
      const response = await fetch(`/api/qc/itp/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "ITP 삭제 실패");
      }

      setDeleteTarget(null);
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
      setMessage("ITP를 삭제했습니다.");
      await loadPlans(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ITP 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  function openOwnerPicker(checkpointId: string) {
    setOwnerPickerCheckpointId(checkpointId);
    setMemberQuery("");
  }

  function applyOwner(member: SiteMemberOption) {
    if (!ownerPickerCheckpointId) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.map((item) =>
        item.checkpointId === ownerPickerCheckpointId
          ? {
              ...item,
              ownerName: member.name,
              ownerMemberId: member._id,
            }
          : item,
      ),
    }));
    setOwnerPickerCheckpointId(null);
    setMemberQuery("");
  }

  const columns: DataTableColumn<QcItpItem>[] = [
    {
      key: "planTitle",
      header: "ITP",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="font-medium text-foreground">{row.planTitle}</div>
          <div className="text-xs text-foreground-muted">
            {row.workType} / {row.processStep}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "버전/상태",
      className: "w-40",
      render: (_value, row) => (
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">
            {row.year}년 Rev.{row.versionNo}
          </div>
          <StatusPill status={row.status} />
        </div>
      ),
    },
    {
      key: "checkpoints",
      header: "체크포인트",
      className: "w-48",
      render: (_value, row) => {
        const summary = calculateCheckpointSummary(row.checkpoints);
        return (
          <div className="space-y-1 text-xs text-foreground-muted">
            <p>
              검사 {summary.inspectionCount}건 / 시험 {summary.testCount}건
            </p>
            <p>
              Hold {summary.holdCount}건 / Witness {summary.witnessCount}건
            </p>
          </div>
        );
      },
    },
    {
      key: "scopeSummary",
      header: "적용 범위",
      render: (value, row) => (
        <div className="space-y-1">
          <div className="line-clamp-2 text-sm text-foreground">{String(value ?? "").trim() || "-"}</div>
          <div className="text-xs text-foreground-muted">
            도면 {row.referenceDrawingNo || "-"} / 시방 {row.referenceSpec || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "updatedAt",
      header: "수정일",
      className: "w-28",
      render: (value) => formatDate(String(value ?? "")),
    },
    {
      key: "actions",
      header: "작업",
      className: "w-44",
      render: (_value, row) =>
        canManage ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-background-soft"
              onClick={(event) => {
                event.stopPropagation();
                applyItemToForm(row);
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
                  planTitle: row.planTitle,
                  year: row.year,
                  versionNo: row.versionNo,
                });
              }}
            >
              삭제
            </button>
            <button
              type="button"
              className="rounded-md border border-sky-200 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
              onClick={(event) => {
                event.stopPropagation();
                duplicateItem(row);
              }}
            >
              복제
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
          <h1 className="text-xl font-semibold text-foreground">검사·시험 계획 (ITP)</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            공종별 검사/시험 기준, Hold/Witness 포인트, 담당자 배정을 버전 단위로 관리합니다.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUserLoading}
          >
            ITP 등록
          </button>
        ) : null}
      </div>

      <QcFeedbackBanners
        message={message}
        error={error ?? workTypeError ?? memberError}
      />

      <QcFilterPanel
        description="ITP명, 공종, 공정 단계, 체크포인트명으로 검색하고 연도/상태/공종별로 조회할 수 있습니다."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadPlans(1)}
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
              options={QcItpSortOptions}
              onChange={(value) => setSortBy(value as QcItpSort)}
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
            placeholder="ITP명, 공종, 공정, 체크포인트"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <FormInput
            label="연도"
            placeholder="2026"
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
          />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">상태</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | QcItpStatus)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QC_ITP_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {QC_ITP_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">공종</span>
            <input
              list="qc-itp-work-type-filter"
              value={workTypeFilter}
              onChange={(event) => setWorkTypeFilter(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="공종 선택 또는 직접입력"
            />
            <datalist id="qc-itp-work-type-filter">
              {workTypeOptions.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.description}
                </option>
              ))}
            </datalist>
          </label>
        </div>
      </QcFilterPanel>

      {showForm ? (
        <section className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {editingId ? "ITP 수정" : "ITP 등록"}
              </h2>
              <p className="text-sm text-foreground-muted">
                공종과 공정 단계 기준으로 검사/시험 체크포인트를 구성합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background-soft"
            >
              닫기
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <FormInput
              label="적용연도"
              value={form.year}
              onChange={(event) => updateFormField("year", event.target.value)}
            />
            <FormInput
              label="버전"
              value={form.versionNo}
              onChange={(event) => updateFormField("versionNo", event.target.value)}
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">상태</span>
              <select
                value={form.status}
                onChange={(event) => updateFormField("status", event.target.value as QcItpStatus)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QC_ITP_STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {QC_ITP_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <FormInput
              label="ITP 제목"
              wrapperClassName="md:col-span-2"
              value={form.planTitle}
              onChange={(event) => updateFormField("planTitle", event.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">공종</label>
              <input
                list="qc-itp-work-type-options"
                value={form.workType}
                onChange={(event) => updateFormField("workType", event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                placeholder="공종 선택 또는 직접입력"
              />
              <datalist id="qc-itp-work-type-options">
                {workTypeOptions.map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.description}
                  </option>
                ))}
              </datalist>
            </div>
            <FormInput
              label="공정 단계"
              value={form.processStep}
              onChange={(event) => updateFormField("processStep", event.target.value)}
            />
            <FormInput
              label="적용 범위"
              wrapperClassName="md:col-span-3"
              value={form.scopeSummary}
              onChange={(event) => updateFormField("scopeSummary", event.target.value)}
            />
            <FormInput
              label="참조 도면"
              value={form.referenceDrawingNo}
              onChange={(event) => updateFormField("referenceDrawingNo", event.target.value)}
            />
            <FormInput
              label="참조 시방"
              value={form.referenceSpec}
              onChange={(event) => updateFormField("referenceSpec", event.target.value)}
            />
            <FormInput
              label="개정 사유"
              wrapperClassName="md:col-span-3"
              value={form.revisionReason}
              onChange={(event) => updateFormField("revisionReason", event.target.value)}
            />
            <label className="space-y-1 md:col-span-3">
              <span className="block text-sm font-medium text-foreground">비고</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateFormField("notes", event.target.value)}
                className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                placeholder="현장별 적용 메모나 참조 기준을 입력합니다."
              />
            </label>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">체크포인트</h3>
              <button
                type="button"
                onClick={addCheckpoint}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background-soft"
              >
                항목 추가
              </button>
            </div>

            <div className="space-y-4">
              {form.checkpoints.map((checkpoint, index) => {
                const ownerOption = checkpoint.ownerMemberId
                  ? memberOptionById.get(checkpoint.ownerMemberId) ?? null
                  : null;

                return (
                  <div key={checkpoint.checkpointId} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">체크포인트 {index + 1}</p>
                        <p className="text-xs text-foreground-muted">
                          공정 단계별 검사/시험 기준과 담당자를 등록합니다.
                        </p>
                      </div>
                      {form.checkpoints.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeCheckpoint(checkpoint.checkpointId)}
                          className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          삭제
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <FormInput
                        label="세부 공정"
                        value={checkpoint.phaseName}
                        onChange={(event) =>
                          updateCheckpointField(checkpoint.checkpointId, "phaseName", event.target.value)
                        }
                      />
                      <FormInput
                        label="검사항목"
                        value={checkpoint.checkpointTitle}
                        onChange={(event) =>
                          updateCheckpointField(checkpoint.checkpointId, "checkpointTitle", event.target.value)
                        }
                      />
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">유형</span>
                        <select
                          value={checkpoint.checkpointType}
                          onChange={(event) =>
                            updateCheckpointField(
                              checkpoint.checkpointId,
                              "checkpointType",
                              event.target.value as QcItpItemType,
                            )
                          }
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        >
                          {QC_ITP_ITEM_TYPE_VALUES.map((value) => (
                            <option key={value} value={value}>
                              {QC_ITP_ITEM_TYPE_LABELS[value]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">Hold/Witness</span>
                        <select
                          value={checkpoint.holdPoint}
                          onChange={(event) =>
                            updateCheckpointField(
                              checkpoint.checkpointId,
                              "holdPoint",
                              event.target.value as QcItpHoldPoint,
                            )
                          }
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        >
                          {QC_ITP_HOLD_POINT_VALUES.map((value) => (
                            <option key={value} value={value}>
                              {QC_ITP_HOLD_POINT_LABELS[value]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <FormInput
                        label="검사 시점"
                        value={checkpoint.timing}
                        onChange={(event) =>
                          updateCheckpointField(checkpoint.checkpointId, "timing", event.target.value)
                        }
                      />
                      <FormInput
                        label="빈도"
                        value={checkpoint.frequency}
                        onChange={(event) =>
                          updateCheckpointField(checkpoint.checkpointId, "frequency", event.target.value)
                        }
                      />
                      <FormInput
                        label="참조 기준"
                        wrapperClassName="md:col-span-3"
                        value={checkpoint.referenceCode}
                        onChange={(event) =>
                          updateCheckpointField(checkpoint.checkpointId, "referenceCode", event.target.value)
                        }
                      />
                      <label className="space-y-1 md:col-span-2">
                        <span className="block text-sm font-medium text-foreground">판정 기준</span>
                        <textarea
                          value={checkpoint.acceptanceCriteria}
                          onChange={(event) =>
                            updateCheckpointField(
                              checkpoint.checkpointId,
                              "acceptanceCriteria",
                              event.target.value,
                            )
                          }
                          className="min-h-24 w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                          placeholder="합격 기준, 허용 오차, 시험 기준 등을 입력합니다."
                        />
                      </label>
                      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
                        <p className="text-sm font-medium text-foreground">담당자</p>
                        <p className="text-sm text-foreground-muted">
                          {formatSiteMemberSummary(ownerOption, checkpoint.ownerName) || "미지정"}
                        </p>
                        <button
                          type="button"
                          onClick={() => openOwnerPicker(checkpoint.checkpointId)}
                          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-background-soft"
                        >
                          현장 인력 선택
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
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
              disabled={isSubmitting}
              className="rounded-md bg-[#ecebe8] px-4 py-1.5 text-sm font-medium text-foreground hover:bg-[#e2e0db] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : editingId ? "수정 저장" : "등록"}
            </button>
          </div>
        </section>
      ) : null}

      <DataTable
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "ITP 목록을 불러오는 중입니다." : "등록된 ITP가 없습니다."}
        onRowClick={(row) => setSelectedItem(row)}
        getRowAriaLabel={(row) => `${row.planTitle} 상세 열기`}
      />

      {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onPageChange={setPage} /> : null}

      <Modal
        open={selectedItem !== null}
        title={selectedItem ? `${selectedItem.planTitle} 상세` : "ITP 상세"}
        onClose={() => setSelectedItem(null)}
      >
        {selectedItem ? (
          <div className="space-y-4 text-sm text-foreground">
            <dl className="grid gap-3 md:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-foreground-muted">ITP 제목</dt>
                <dd className="mt-1 font-medium">{selectedItem.planTitle}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">버전/상태</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span>
                    {selectedItem.year}년 Rev.{selectedItem.versionNo}
                  </span>
                  <StatusPill status={selectedItem.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">공종</dt>
                <dd className="mt-1">{selectedItem.workType}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">공정 단계</dt>
                <dd className="mt-1">{selectedItem.processStep}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs font-medium text-foreground-muted">적용 범위</dt>
                <dd className="mt-1">{selectedItem.scopeSummary}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">참조 도면</dt>
                <dd className="mt-1">{selectedItem.referenceDrawingNo || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-foreground-muted">참조 시방</dt>
                <dd className="mt-1">{selectedItem.referenceSpec || "-"}</dd>
              </div>
            </dl>

            <div>
              <p className="text-xs font-medium text-foreground-muted">관련 QC 화면</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href="/qc/material-inspection"
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background-soft"
                >
                  자재 검사
                </Link>
                <Link
                  href="/qc/process-inspection"
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background-soft"
                >
                  공정 검사
                </Link>
                <Link
                  href="/qc/handover-inspection"
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background-soft"
                >
                  인수·준공 검사
                </Link>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">체크포인트</p>
              <div className="mt-2 space-y-2">
                {selectedItem.checkpoints.map((checkpoint, index) => (
                  <div key={checkpoint.checkpointId} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {index + 1}. {checkpoint.phaseName} / {checkpoint.checkpointTitle}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {QC_ITP_ITEM_TYPE_LABELS[checkpoint.checkpointType]}
                      </span>
                      <HoldPointPill holdPoint={checkpoint.holdPoint} />
                    </div>
                    <p className="mt-2 text-xs text-foreground-muted">
                      시점 {checkpoint.timing || "-"} / 빈도 {checkpoint.frequency || "-"} / 담당자{" "}
                      {checkpoint.ownerName || "-"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      판정 기준: {checkpoint.acceptanceCriteria}
                    </p>
                    {checkpoint.referenceCode ? (
                      <p className="mt-1 text-xs text-foreground-muted">참조 기준: {checkpoint.referenceCode}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {selectedItem.notes ? (
              <div>
                <p className="text-xs font-medium text-foreground-muted">비고</p>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-background-soft px-3 py-2">
                  {selectedItem.notes}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="ITP 삭제"
        onClose={() => (deletingId ? null : setDeleteTarget(null))}
      >
        {deleteTarget ? (
          <div className="space-y-4 text-sm text-foreground">
            <p>
              <strong>{deleteTarget.planTitle}</strong> ITP를 삭제합니다.
            </p>
            <p className="text-foreground-muted">
              {deleteTarget.year}년 Rev.{deleteTarget.versionNo}
            </p>
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
        open={ownerPickerCheckpointId !== null}
        title="담당자 선택"
        onClose={() => setOwnerPickerCheckpointId(null)}
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
                  onClick={() => applyOwner(member)}
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
