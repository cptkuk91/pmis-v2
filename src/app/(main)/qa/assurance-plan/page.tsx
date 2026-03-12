"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QaFeedbackBanners } from "@/components/qa/feedback-banners";
import { QaFilterPanel } from "@/components/qa/filter-panel";
import { QaSortSelect } from "@/components/qa/sort-select";
import { DataTable, FormInput, Modal, Pagination } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import {
  useSiteMembers,
  formatSiteMemberSummary,
  type SiteMemberOption,
} from "@/hooks/use-site-members";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import {
  QA_ASSURANCE_CHECKPOINT_STATUS_LABELS,
  QA_ASSURANCE_CHECKPOINT_STATUS_VALUES,
  QA_ASSURANCE_PLAN_STATUS_LABELS,
  QA_ASSURANCE_PLAN_STATUS_VALUES,
  type QaAssuranceCheckpointStatus,
  type QaAssurancePlanStatus,
} from "@/lib/qa-assurance-plans";

type PolicyGoalOption = {
  _id: string;
  year: number;
  revisionNo: number;
  policyTitle: string;
  status: string;
};

type AssuranceCheckpointRow = {
  checkpointId: string;
  phaseName: string;
  checkpointTitle: string;
  inspectionMethod: string;
  acceptanceCriteria: string;
  referenceProcedure: string;
  ownerName: string;
  ownerMemberId: string;
  status: QaAssuranceCheckpointStatus;
};

type AssurancePlanItem = {
  _id: string;
  year: number;
  versionNo: number;
  status: QaAssurancePlanStatus;
  planTitle: string;
  revisionReason: string;
  linkedPolicyGoalId: string;
  linkedPolicyGoalTitle: string;
  linkedPolicyGoalYear?: number | null;
  linkedPolicyGoalRevisionNo?: number | null;
  scopeSummary: string;
  qualityObjectiveSummary: string;
  templateReference: string;
  checkpoints: AssuranceCheckpointRow[];
  createdAt: string;
  updatedAt: string;
  actions?: string;
};

type AssurancePlanForm = {
  year: string;
  versionNo: string;
  status: QaAssurancePlanStatus;
  planTitle: string;
  revisionReason: string;
  linkedPolicyGoalId: string;
  linkedPolicyGoalTitle: string;
  linkedPolicyGoalYear: string;
  linkedPolicyGoalRevisionNo: string;
  scopeSummary: string;
  qualityObjectiveSummary: string;
  templateReference: string;
  checkpoints: AssuranceCheckpointRow[];
};

type AssurancePlanResponse = {
  ok: boolean;
  data: AssurancePlanItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type DeleteTarget = Pick<AssurancePlanItem, "_id" | "planTitle" | "year" | "versionNo">;
type AssurancePlanSort = "year_desc" | "year_asc" | "title_asc" | "status_asc";

const ASSURANCE_PLAN_SORT_OPTIONS: Array<{ value: AssurancePlanSort; label: string }> = [
  { value: "year_desc", label: "연도 최신순" },
  { value: "year_asc", label: "연도 오래된순" },
  { value: "title_asc", label: "계획명순" },
  { value: "status_asc", label: "상태순" },
];

function createCheckpointDraft(): AssuranceCheckpointRow {
  const checkpointId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `checkpoint-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    checkpointId,
    phaseName: "",
    checkpointTitle: "",
    inspectionMethod: "",
    acceptanceCriteria: "",
    referenceProcedure: "",
    ownerName: "",
    ownerMemberId: "",
    status: "planned",
  };
}

function createEmptyForm(): AssurancePlanForm {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    versionNo: "1",
    status: "draft",
    planTitle: `${now.getFullYear()} 품질보증계획`,
    revisionReason: "",
    linkedPolicyGoalId: "",
    linkedPolicyGoalTitle: "",
    linkedPolicyGoalYear: "",
    linkedPolicyGoalRevisionNo: "",
    scopeSummary: "",
    qualityObjectiveSummary: "",
    templateReference: "",
    checkpoints: [createCheckpointDraft()],
  };
}

function buildPolicyGoalLabel(item: PolicyGoalOption) {
  return `${item.year}년 Rev.${item.revisionNo} · ${item.policyTitle}`;
}

function calculateProgressPercent(checkpoints: AssuranceCheckpointRow[]) {
  if (!checkpoints.length) {
    return 0;
  }
  const completed = checkpoints.filter((item) => item.status === "completed").length;
  return Math.round((completed / checkpoints.length) * 100);
}

function StatusPill({ status }: { status: QaAssurancePlanStatus }) {
  const toneClass =
    status === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "archived"
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : status === "in_review"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_ASSURANCE_PLAN_STATUS_LABELS[status]}
    </span>
  );
}

export default function QaAssurancePlanPage() {
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

  const [policyGoalOptions, setPolicyGoalOptions] = useState<PolicyGoalOption[]>([]);
  const [policyGoalError, setPolicyGoalError] = useState<string | null>(null);
  const [items, setItems] = useState<AssurancePlanItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QaAssurancePlanStatus>("all");
  const [sortBy, setSortBy] = useState<AssurancePlanSort>("year_desc");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssurancePlanForm>(() => createEmptyForm());
  const [selectedItem, setSelectedItem] = useState<AssurancePlanItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ownerPickerCheckpointId, setOwnerPickerCheckpointId] = useState<string | null>(null);

  const loadPolicyGoalOptions = useCallback(async () => {
    try {
      setPolicyGoalError(null);
      const response = await fetch("/api/qa/policy-goals?limit=100", { cache: "no-store" });
      const result = (await response.json()) as {
        ok: boolean;
        data?: PolicyGoalOption[];
        error?: string;
      };
      if (!result.ok) {
        throw new Error(result.error ?? "품질 정책·목표 목록 조회 실패");
      }
      setPolicyGoalOptions(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setPolicyGoalOptions([]);
      setPolicyGoalError(err instanceof Error ? err.message : "품질 정책·목표 목록 조회 실패");
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

        const response = await fetch(`/api/qa/assurance-plans?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as AssurancePlanResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "품질보증계획 조회 실패");
        }

        setItems(Array.isArray(result.data) ? result.data : []);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "품질보증계획 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, sortBy, statusFilter, yearFilter],
  );

  useEffect(() => {
    void loadPlans(1);
  }, [loadPlans]);

  useEffect(() => {
    if (!canManage) {
      setPolicyGoalOptions([]);
      return;
    }
    void loadPolicyGoalOptions();
  }, [canManage, loadPolicyGoalOptions]);

  function resetFilters() {
    setKeyword("");
    setYearFilter("");
    setStatusFilter("all");
    setSortBy("year_desc");
    void loadPlans(1);
  }

  const relatedVersions = useMemo(() => {
    if (!selectedItem) {
      return [];
    }
    return items
      .filter(
        (item) =>
          item._id !== selectedItem._id &&
          item.year === selectedItem.year &&
          item.planTitle.trim() === selectedItem.planTitle.trim(),
      )
      .sort((a, b) => b.versionNo - a.versionNo);
  }, [items, selectedItem]);

  const handlePolicyGoalChange = useCallback(
    (policyGoalId: string) => {
      const selected = policyGoalOptions.find((item) => item._id === policyGoalId);
      setForm((current) => ({
        ...current,
        linkedPolicyGoalId: selected?._id ?? "",
        linkedPolicyGoalTitle: selected?.policyTitle ?? "",
        linkedPolicyGoalYear: selected ? String(selected.year) : "",
        linkedPolicyGoalRevisionNo: selected ? String(selected.revisionNo) : "",
      }));
    },
    [policyGoalOptions],
  );

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setOwnerPickerCheckpointId(null);
  }

  function updateFormField<K extends keyof AssurancePlanForm>(field: K, value: AssurancePlanForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCheckpointField<K extends keyof AssuranceCheckpointRow>(
    checkpointId: string,
    field: K,
    value: AssuranceCheckpointRow[K],
  ) {
    setForm((current) => ({
      ...current,
      checkpoints: current.checkpoints.map((item) =>
        item.checkpointId === checkpointId ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function handleAddCheckpoint() {
    setForm((current) => ({
      ...current,
      checkpoints: [...current.checkpoints, createCheckpointDraft()],
    }));
  }

  function handleRemoveCheckpoint(checkpointId: string) {
    setForm((current) => {
      if (current.checkpoints.length === 1) {
        return current;
      }
      return {
        ...current,
        checkpoints: current.checkpoints.filter((item) => item.checkpointId !== checkpointId),
      };
    });
    if (ownerPickerCheckpointId === checkpointId) {
      setOwnerPickerCheckpointId(null);
    }
  }

  function handleOpenOwnerPicker(checkpointId: string) {
    setMemberQuery("");
    setOwnerPickerCheckpointId(checkpointId);
  }

  function handleSelectOwner(member: SiteMemberOption) {
    if (!ownerPickerCheckpointId) {
      return;
    }
    setForm((current) => ({
      ...current,
      checkpoints: current.checkpoints.map((item) =>
        item.checkpointId === ownerPickerCheckpointId
          ? { ...item, ownerName: member.name, ownerMemberId: member._id }
          : item,
      ),
    }));
    setOwnerPickerCheckpointId(null);
  }

  function handleClearOwner(checkpointId: string) {
    setForm((current) => ({
      ...current,
      checkpoints: current.checkpoints.map((item) =>
        item.checkpointId === checkpointId ? { ...item, ownerName: "", ownerMemberId: "" } : item,
      ),
    }));
  }

  const handleEdit = useCallback((item: AssurancePlanItem) => {
    setEditingId(item._id);
    setForm({
      year: String(item.year),
      versionNo: String(item.versionNo),
      status: item.status,
      planTitle: item.planTitle,
      revisionReason: item.revisionReason,
      linkedPolicyGoalId: item.linkedPolicyGoalId,
      linkedPolicyGoalTitle: item.linkedPolicyGoalTitle,
      linkedPolicyGoalYear: item.linkedPolicyGoalYear ? String(item.linkedPolicyGoalYear) : "",
      linkedPolicyGoalRevisionNo: item.linkedPolicyGoalRevisionNo
        ? String(item.linkedPolicyGoalRevisionNo)
        : "",
      scopeSummary: item.scopeSummary,
      qualityObjectiveSummary: item.qualityObjectiveSummary,
      templateReference: item.templateReference,
      checkpoints: item.checkpoints.length
        ? item.checkpoints.map((checkpoint) => ({
            checkpointId: checkpoint.checkpointId,
            phaseName: checkpoint.phaseName,
            checkpointTitle: checkpoint.checkpointTitle,
            inspectionMethod: checkpoint.inspectionMethod,
            acceptanceCriteria: checkpoint.acceptanceCriteria,
            referenceProcedure: checkpoint.referenceProcedure,
            ownerName: checkpoint.ownerName,
            ownerMemberId: checkpoint.ownerMemberId,
            status: checkpoint.status,
          }))
        : [createCheckpointDraft()],
    });
    setSelectedItem(null);
    setMessage(null);
    setError(null);
  }, []);

  const handleRequestDelete = useCallback(
    (item: AssurancePlanItem) => {
      if (!canManage) {
        return;
      }
      setDeleteTarget({
        _id: item._id,
        planTitle: item.planTitle,
        year: item.year,
        versionNo: item.versionNo,
      });
      setMessage(null);
      setError(null);
    },
    [canManage],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const endpoint = editingId ? `/api/qa/assurance-plans/${editingId}` : "/api/qa/assurance-plans";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: Number(form.year),
          versionNo: Number(form.versionNo),
          status: form.status,
          planTitle: form.planTitle,
          revisionReason: form.revisionReason,
          linkedPolicyGoalId: form.linkedPolicyGoalId,
          linkedPolicyGoalTitle: form.linkedPolicyGoalTitle,
          linkedPolicyGoalYear: form.linkedPolicyGoalYear,
          linkedPolicyGoalRevisionNo: form.linkedPolicyGoalRevisionNo,
          scopeSummary: form.scopeSummary,
          qualityObjectiveSummary: form.qualityObjectiveSummary,
          templateReference: form.templateReference,
          checkpoints: form.checkpoints.map((checkpoint) => ({
            checkpointId: checkpoint.checkpointId,
            phaseName: checkpoint.phaseName,
            checkpointTitle: checkpoint.checkpointTitle,
            inspectionMethod: checkpoint.inspectionMethod,
            acceptanceCriteria: checkpoint.acceptanceCriteria,
            referenceProcedure: checkpoint.referenceProcedure,
            ownerName: checkpoint.ownerName,
            ownerMemberId: checkpoint.ownerMemberId,
            status: checkpoint.status,
          })),
        }),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "품질보증계획 저장 실패");
      }

      setMessage(editingId ? "품질보증계획이 수정되었습니다." : "품질보증계획이 등록되었습니다.");
      resetForm();
      await loadPlans(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "품질보증계획 저장 실패");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!canManage || !deleteTarget) {
      return;
    }

    setDeletingId(deleteTarget._id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/qa/assurance-plans/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "품질보증계획 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        resetForm();
      }
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
      setDeleteTarget(null);
      setMessage("품질보증계획이 삭제되었습니다.");
      await loadPlans(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "품질보증계획 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo<DataTableColumn<AssurancePlanItem>[]>(
    () => [
      {
        key: "year",
        header: "연도/버전",
        className: "w-28 align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.year}년</p>
            <p className="text-xs text-foreground-muted">Ver.{row.versionNo}</p>
          </div>
        ),
      },
      {
        key: "planTitle",
        header: "QAP",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.planTitle}</p>
            <p className="text-xs text-foreground-muted">
              {row.linkedPolicyGoalTitle
                ? `연결 목표: ${row.linkedPolicyGoalTitle}`
                : "연결된 품질 정책·목표 없음"}
            </p>
          </div>
        ),
      },
      {
        key: "checkpoints",
        header: "체크포인트/진행률",
        className: "min-w-[240px] align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {row.checkpoints.length}건 · {calculateProgressPercent(row.checkpoints)}%
            </p>
            {row.checkpoints.slice(0, 2).map((checkpoint) => (
              <div key={checkpoint.checkpointId} className="rounded-md bg-background-soft px-2 py-1">
                <p className="text-xs font-medium text-foreground">{checkpoint.phaseName}</p>
                <p className="text-xs text-foreground-muted">{checkpoint.checkpointTitle}</p>
              </div>
            ))}
            {row.checkpoints.length > 2 ? (
              <p className="text-xs text-foreground-muted">외 {row.checkpoints.length - 2}건</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "status",
        header: "상태",
        className: "w-24",
        render: (value) => <StatusPill status={value as QaAssurancePlanStatus} />,
      },
      {
        key: "actions",
        header: "작업",
        className: "w-32",
        render: (_value, row) =>
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleEdit(row);
                }}
                className="rounded-md border border-border bg-background-soft px-3 py-1 text-xs font-medium text-foreground hover:bg-background-card"
              >
                수정
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRequestDelete(row);
                }}
                className="rounded-md border border-danger/40 bg-danger/5 px-3 py-1 text-xs font-medium text-danger hover:bg-danger/10"
              >
                삭제
              </button>
            </div>
          ) : (
            <span className="text-xs text-foreground-muted">조회</span>
          ),
      },
    ],
    [canManage, handleEdit, handleRequestDelete],
  );

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-muted">QA</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">품질보증계획 (QAP)</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          정책·목표 기준을 참조해 QAP 버전과 공종별 체크포인트를 관리합니다.
        </p>
      </header>

      <QaFilterPanel
        description="연도와 상태 기준으로 버전별 QAP를 빠르게 추적합니다."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadPlans(1)}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
            >
              필터 초기화
            </button>
          </>
        }
        footer={
          <QaSortSelect
            compact
            value={sortBy}
            options={ASSURANCE_PLAN_SORT_OPTIONS}
            onChange={(value) => setSortBy(value as AssurancePlanSort)}
          />
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_180px_180px]">
          <FormInput
            label="검색어"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="QAP 제목, 적용 범위, 체크포인트"
          />
          <FormInput
            label="적용연도"
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            placeholder="예: 2026"
            inputMode="numeric"
          />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">상태</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | QaAssurancePlanStatus)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_ASSURANCE_PLAN_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {QA_ASSURANCE_PLAN_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </QaFilterPanel>

      {canManage ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {editingId ? "품질보증계획 수정" : "품질보증계획 등록"}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                버전과 상태, 정책·목표 연결, 체크포인트를 함께 관리합니다.
              </p>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
              >
                편집 취소
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <FormInput
              label="적용연도"
              value={form.year}
              onChange={(event) =>
                updateFormField("year", event.target.value.replace(/[^0-9]/g, "").slice(0, 4))
              }
              required
              inputMode="numeric"
            />
            <FormInput
              label="버전"
              value={form.versionNo}
              onChange={(event) =>
                updateFormField("versionNo", event.target.value.replace(/[^0-9]/g, "").slice(0, 2))
              }
              required
              inputMode="numeric"
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">상태</span>
              <select
                value={form.status}
                onChange={(event) =>
                  updateFormField("status", event.target.value as QaAssurancePlanStatus)
                }
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_ASSURANCE_PLAN_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {QA_ASSURANCE_PLAN_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <FormInput
              label="문서/템플릿 참조"
              value={form.templateReference}
              onChange={(event) => updateFormField("templateReference", event.target.value)}
              placeholder="예: QAP 기본 템플릿 v1"
            />
          </div>

          <FormInput
            label="QAP 제목"
            value={form.planTitle}
            onChange={(event) => updateFormField("planTitle", event.target.value)}
            required
          />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr]">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">연결 품질 정책·목표</span>
              <select
                value={form.linkedPolicyGoalId}
                onChange={(event) => handlePolicyGoalChange(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="">선택 안함</option>
                {policyGoalOptions.map((option) => (
                  <option key={option._id} value={option._id}>
                    {buildPolicyGoalLabel(option)}
                  </option>
                ))}
              </select>
              {policyGoalError ? <p className="text-xs text-danger">{policyGoalError}</p> : null}
            </label>
            <FormInput
              label="개정 사유"
              value={form.revisionReason}
              onChange={(event) => updateFormField("revisionReason", event.target.value)}
              placeholder="초판, 공정 변경 반영 등"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">적용 범위</span>
              <textarea
                value={form.scopeSummary}
                onChange={(event) => updateFormField("scopeSummary", event.target.value)}
                rows={4}
                required
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                placeholder="적용 대상 공종, 현장 범위, 품질보증 범위를 입력하세요."
              />
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">품질 목표 요약</span>
              <textarea
                value={form.qualityObjectiveSummary}
                onChange={(event) => updateFormField("qualityObjectiveSummary", event.target.value)}
                rows={4}
                required
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                placeholder="연결 목표와 품질 달성 방향을 요약하세요."
              />
            </label>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-background-soft p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">공종/공정별 체크포인트</h3>
                <p className="mt-1 text-xs text-foreground-muted">
                  검사 방법과 합격 기준, 담당자, 진행 상태를 정의합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCheckpoint}
                className="rounded-md border border-border bg-background-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
              >
                체크포인트 추가
              </button>
            </div>

            <div className="space-y-3">
              {form.checkpoints.map((checkpoint, index) => {
                const selectedOwner = checkpoint.ownerMemberId
                  ? memberOptionById.get(checkpoint.ownerMemberId) ?? null
                  : null;
                return (
                  <div key={checkpoint.checkpointId} className="rounded-lg border border-border bg-background-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">체크포인트 {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveCheckpoint(checkpoint.checkpointId)}
                        disabled={form.checkpoints.length === 1}
                        className="rounded-md border border-border px-3 py-1 text-xs text-foreground-muted hover:bg-background-soft disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <FormInput
                        label="공종/공정"
                        value={checkpoint.phaseName}
                        onChange={(event) =>
                          updateCheckpointField(checkpoint.checkpointId, "phaseName", event.target.value)
                        }
                        required
                      />
                      <FormInput
                        label="체크포인트명"
                        value={checkpoint.checkpointTitle}
                        onChange={(event) =>
                          updateCheckpointField(
                            checkpoint.checkpointId,
                            "checkpointTitle",
                            event.target.value,
                          )
                        }
                        required
                      />
                      <FormInput
                        label="검사 방법"
                        value={checkpoint.inspectionMethod}
                        onChange={(event) =>
                          updateCheckpointField(
                            checkpoint.checkpointId,
                            "inspectionMethod",
                            event.target.value,
                          )
                        }
                        placeholder="서류 확인, 육안 점검, 치수 측정"
                      />
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">진행 상태</span>
                        <select
                          value={checkpoint.status}
                          onChange={(event) =>
                            updateCheckpointField(
                              checkpoint.checkpointId,
                              "status",
                              event.target.value as QaAssuranceCheckpointStatus,
                            )
                          }
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        >
                          {QA_ASSURANCE_CHECKPOINT_STATUS_VALUES.map((status) => (
                            <option key={status} value={status}>
                              {QA_ASSURANCE_CHECKPOINT_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 lg:col-span-2">
                        <span className="block text-sm font-medium text-foreground">합격 기준</span>
                        <textarea
                          value={checkpoint.acceptanceCriteria}
                          onChange={(event) =>
                            updateCheckpointField(
                              checkpoint.checkpointId,
                              "acceptanceCriteria",
                              event.target.value,
                            )
                          }
                          rows={2}
                          required
                          className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                          placeholder="검사 합격 기준과 허용 오차를 입력하세요."
                        />
                      </label>
                      <FormInput
                        label="참조 절차/문서"
                        value={checkpoint.referenceProcedure}
                        onChange={(event) =>
                          updateCheckpointField(
                            checkpoint.checkpointId,
                            "referenceProcedure",
                            event.target.value,
                          )
                        }
                        placeholder="예: 콘크리트 타설 SOP v2"
                      />
                      <div className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">담당자</span>
                        <div className="flex flex-col gap-2 md:flex-row">
                          <input
                            readOnly
                            value={formatSiteMemberSummary(selectedOwner, checkpoint.ownerName)}
                            placeholder="현장 인력에서 선택"
                            className="h-9 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() => handleOpenOwnerPicker(checkpoint.checkpointId)}
                            className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                          >
                            사용자 선택
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearOwner(checkpoint.checkpointId)}
                            className="rounded-md border border-border bg-background-card px-3 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                          >
                            초기화
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background-soft px-4 py-3 text-sm text-foreground-muted">
            계획 대비 실행률:{" "}
            <span className="font-semibold text-foreground">
              {calculateProgressPercent(form.checkpoints)}%
            </span>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card disabled:opacity-60"
            >
              {editingId ? "수정 저장" : "등록"}
            </button>
          </div>
        </form>
      ) : isUserLoading ? null : (
        <div className="rounded-xl border border-border bg-background-card p-5 text-sm text-foreground-muted shadow-[var(--shadow-soft)]">
          등록/수정/삭제는 `manager` 이상 권한이 필요합니다.
        </div>
      )}

      <QaFeedbackBanners message={message} error={error} />

      <DataTable<AssurancePlanItem>
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "품질보증계획을 불러오는 중입니다." : "등록된 품질보증계획이 없습니다."}
        onRowClick={(row) => setSelectedItem(row)}
        getRowAriaLabel={(row) => `${row.year}년 ${row.planTitle} 상세 보기`}
      />

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadPlans(nextPage)} />
      ) : null}

      <Modal
        open={selectedItem !== null}
        title="품질보증계획 상세"
        onClose={() => setSelectedItem(null)}
      >
        {selectedItem ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background-soft p-3 text-sm">
              <div>
                <p className="text-xs font-medium text-foreground-muted">적용연도</p>
                <p className="mt-1 text-foreground">{selectedItem.year}년</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">버전</p>
                <p className="mt-1 text-foreground">Ver.{selectedItem.versionNo}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">상태</p>
                <div className="mt-1">
                  <StatusPill status={selectedItem.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">진행률</p>
                <p className="mt-1 text-foreground">{calculateProgressPercent(selectedItem.checkpoints)}%</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">QAP 제목</p>
              <p className="mt-1 font-medium text-foreground">{selectedItem.planTitle}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">연결 품질 정책·목표</p>
              <p className="mt-1 text-sm text-foreground">
                {selectedItem.linkedPolicyGoalTitle
                  ? `${selectedItem.linkedPolicyGoalTitle} (${selectedItem.linkedPolicyGoalYear ?? "-"}년 Rev.${selectedItem.linkedPolicyGoalRevisionNo ?? "-"})`
                  : "연결 안함"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">적용 범위</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.scopeSummary}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">품질 목표 요약</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.qualityObjectiveSummary}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-foreground-muted">개정 사유</p>
                <p className="mt-1 text-sm text-foreground">{selectedItem.revisionReason || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">문서/템플릿 참조</p>
                <p className="mt-1 text-sm text-foreground">{selectedItem.templateReference || "-"}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground-muted">체크포인트</p>
              {selectedItem.checkpoints.map((checkpoint) => (
                <div key={checkpoint.checkpointId} className="rounded-lg border border-border bg-background-soft p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {checkpoint.phaseName} · {checkpoint.checkpointTitle}
                    </p>
                    <span className="text-xs text-foreground-muted">
                      {QA_ASSURANCE_CHECKPOINT_STATUS_LABELS[checkpoint.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{checkpoint.acceptanceCriteria}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    검사 방법: {checkpoint.inspectionMethod || "-"} / 담당자: {checkpoint.ownerName || "미지정"}
                  </p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    참조 절차: {checkpoint.referenceProcedure || "-"}
                  </p>
                </div>
              ))}
            </div>

            {relatedVersions.length ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground-muted">관련 버전</p>
                <div className="space-y-2">
                  {relatedVersions.map((item) => (
                    <div key={item._id} className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground">
                      {item.year}년 Ver.{item.versionNo} · {QA_ASSURANCE_PLAN_STATUS_LABELS[item.status]}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {canManage ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleEdit(selectedItem)}
                  className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                >
                  수정으로 열기
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="품질보증계획 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">아래 품질보증계획을 삭제하시겠습니까?</p>
            <div className="rounded-lg border border-border bg-background-soft p-3 text-sm text-foreground">
              <p className="font-medium">{deleteTarget.planTitle}</p>
              <p className="mt-1 text-foreground-muted">
                {deleteTarget.year}년 · Ver.{deleteTarget.versionNo}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId !== null}
                className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deletingId !== null}
                className="rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/15 disabled:opacity-60"
              >
                삭제
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
            label="검색"
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder="이름, 이메일, 역할"
          />

          {memberError ? <p className="text-sm text-danger">{memberError}</p> : null}

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {isMemberLoading ? (
              <p className="text-sm text-foreground-muted">현장 인력을 불러오는 중입니다.</p>
            ) : filteredMembers.length ? (
              filteredMembers.map((member) => (
                <button
                  key={member._id}
                  type="button"
                  onClick={() => handleSelectOwner(member)}
                  className="block w-full rounded-lg border border-border bg-background-soft px-3 py-2 text-left hover:bg-background-card"
                >
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {member.email || "이메일 없음"} · {member.membershipRole}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-sm text-foreground-muted">선택 가능한 현장 인력이 없습니다.</p>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
