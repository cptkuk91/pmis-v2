"use client";

import Link from "next/link";
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
  QA_MEASUREMENT_CYCLE_LABELS,
  QA_MEASUREMENT_CYCLE_VALUES,
  QA_POLICY_GOAL_STATUS_LABELS,
  QA_POLICY_GOAL_STATUS_VALUES,
  type QaMeasurementCycle,
  type QaPolicyGoalStatus,
} from "@/lib/qa-policy-goals";

type PolicyGoalRow = {
  goalId: string;
  title: string;
  metricName: string;
  unit: string;
  targetValue: string;
  measurementCycle: QaMeasurementCycle;
  ownerName: string;
  ownerMemberId: string;
  note: string;
};

type PolicyGoalItem = {
  _id: string;
  year: number;
  status: QaPolicyGoalStatus;
  policyTitle: string;
  policyStatement: string;
  effectiveDate?: string | null;
  revisionNo: number;
  goals: PolicyGoalRow[];
  createdAt: string;
  updatedAt: string;
  actions?: string;
};

type PolicyGoalResponse = {
  ok: boolean;
  data: PolicyGoalItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type PolicyGoalForm = {
  year: string;
  status: QaPolicyGoalStatus;
  policyTitle: string;
  policyStatement: string;
  effectiveDate: string;
  revisionNo: string;
  goals: PolicyGoalRow[];
};

type DeleteTarget = Pick<PolicyGoalItem, "_id" | "policyTitle" | "year" | "revisionNo">;
type PolicyGoalSort = "year_desc" | "year_asc" | "title_asc" | "status_asc";

const POLICY_GOAL_SORT_OPTIONS: Array<{ value: PolicyGoalSort; label: string }> = [
  { value: "year_desc", label: "연도 최신순" },
  { value: "year_asc", label: "연도 오래된순" },
  { value: "title_asc", label: "방침 제목순" },
  { value: "status_asc", label: "상태순" },
];

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 10);
}

function truncateText(value: string, length = 100) {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length)}...`;
}

function createGoalDraft(): PolicyGoalRow {
  const draftId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `goal-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    goalId: draftId,
    title: "",
    metricName: "",
    unit: "",
    targetValue: "",
    measurementCycle: "monthly",
    ownerName: "",
    ownerMemberId: "",
    note: "",
  };
}

function createEmptyForm(): PolicyGoalForm {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    status: "draft",
    policyTitle: `${now.getFullYear()} 현장 품질방침`,
    policyStatement: "",
    effectiveDate: now.toISOString().slice(0, 10),
    revisionNo: "1",
    goals: [createGoalDraft()],
  };
}

function StatusPill({ status }: { status: QaPolicyGoalStatus }) {
  const toneClass =
    status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "archived"
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_POLICY_GOAL_STATUS_LABELS[status]}
    </span>
  );
}

export default function QaPolicyGoalsPage() {
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

  const memberOptionById = useMemo(() => {
    return new Map(memberOptions.map((item) => [item._id, item]));
  }, [memberOptions]);

  const [items, setItems] = useState<PolicyGoalItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QaPolicyGoalStatus>("all");
  const [sortBy, setSortBy] = useState<PolicyGoalSort>("year_desc");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopyingPrevious, setIsCopyingPrevious] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyGoalForm>(() => createEmptyForm());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PolicyGoalItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [ownerPickerGoalId, setOwnerPickerGoalId] = useState<string | null>(null);

  const loadItems = useCallback(
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

        const response = await fetch(`/api/qa/policy-goals?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as PolicyGoalResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "품질 정책·목표 조회 실패");
        }

        setItems(Array.isArray(result.data) ? result.data : []);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "품질 정책·목표 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [keyword, sortBy, statusFilter, yearFilter],
  );

  useEffect(() => {
    void loadItems(1);
  }, [loadItems]);

  function resetFilters() {
    setKeyword("");
    setYearFilter("");
    setStatusFilter("all");
    setSortBy("year_desc");
    void loadItems(1);
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setOwnerPickerGoalId(null);
  }

  function updateFormField<K extends keyof PolicyGoalForm>(field: K, value: PolicyGoalForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateGoalField<K extends keyof PolicyGoalRow>(
    goalId: string,
    field: K,
    value: PolicyGoalRow[K],
  ) {
    setForm((current) => ({
      ...current,
      goals: current.goals.map((goal) => (goal.goalId === goalId ? { ...goal, [field]: value } : goal)),
    }));
  }

  function handleAddGoalRow() {
    setForm((current) => ({
      ...current,
      goals: [...current.goals, createGoalDraft()],
    }));
  }

  function handleRemoveGoalRow(goalId: string) {
    setForm((current) => {
      if (current.goals.length === 1) {
        return current;
      }
      return {
        ...current,
        goals: current.goals.filter((goal) => goal.goalId !== goalId),
      };
    });
    if (ownerPickerGoalId === goalId) {
      setOwnerPickerGoalId(null);
    }
  }

  function handleOpenOwnerPicker(goalId: string) {
    setMemberQuery("");
    setOwnerPickerGoalId(goalId);
  }

  function handleSelectOwner(member: SiteMemberOption) {
    if (!ownerPickerGoalId) {
      return;
    }
    setForm((current) => ({
      ...current,
      goals: current.goals.map((goal) =>
        goal.goalId === ownerPickerGoalId
          ? { ...goal, ownerName: member.name, ownerMemberId: member._id }
          : goal,
      ),
    }));
    setOwnerPickerGoalId(null);
  }

  function handleClearOwner(goalId: string) {
    setForm((current) => ({
      ...current,
      goals: current.goals.map((goal) =>
        goal.goalId === goalId ? { ...goal, ownerName: "", ownerMemberId: "" } : goal,
      ),
    }));
  }

  async function handleLoadPreviousYearGoals() {
    const targetYear = Number(form.year);
    if (!Number.isInteger(targetYear) || targetYear < 2000 || targetYear > 2100) {
      setError("전년도 기준을 불러오려면 먼저 적용연도를 올바르게 입력해야 합니다.");
      setMessage(null);
      return;
    }

    const previousYear = targetYear - 1;
    setIsCopyingPrevious(true);
    setError(null);
    setMessage(null);

    try {
      const params = new URLSearchParams({
        year: String(previousYear),
        limit: "1",
      });
      const response = await fetch(`/api/qa/policy-goals?${params.toString()}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as PolicyGoalResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "전년도 품질 정책·목표 조회 실패");
      }

      const source = Array.isArray(result.data) ? result.data[0] : null;
      if (!source) {
        throw new Error(`${previousYear}년 품질 정책·목표가 없습니다.`);
      }

      setEditingId(null);
      setSelectedItem(null);
      setForm((current) => ({
        ...current,
        status: "draft",
        policyTitle: source.policyTitle.replace(String(source.year), String(targetYear)),
        policyStatement: source.policyStatement,
        effectiveDate: `${targetYear}-01-01`,
        revisionNo: "1",
        goals: source.goals.map((goal) => ({
          goalId: createGoalDraft().goalId,
          title: goal.title,
          metricName: goal.metricName,
          unit: goal.unit,
          targetValue: goal.targetValue,
          measurementCycle: goal.measurementCycle,
          ownerName: goal.ownerName,
          ownerMemberId: goal.ownerMemberId,
          note: goal.note,
        })),
      }));
      setMessage(`${previousYear}년 기준을 ${targetYear}년 초안으로 불러왔습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "전년도 품질 정책·목표 불러오기 실패");
    } finally {
      setIsCopyingPrevious(false);
    }
  }

  const handleEdit = useCallback((item: PolicyGoalItem) => {
    setEditingId(item._id);
    setForm({
      year: String(item.year),
      status: item.status,
      policyTitle: item.policyTitle,
      policyStatement: item.policyStatement,
      effectiveDate: formatDate(item.effectiveDate) === "-" ? "" : formatDate(item.effectiveDate),
      revisionNo: String(item.revisionNo),
      goals: item.goals.length
        ? item.goals.map((goal) => ({
            goalId: goal.goalId,
            title: goal.title,
            metricName: goal.metricName,
            unit: goal.unit,
            targetValue: goal.targetValue,
            measurementCycle: goal.measurementCycle,
            ownerName: goal.ownerName,
            ownerMemberId: goal.ownerMemberId,
            note: goal.note,
          }))
        : [createGoalDraft()],
    });
    setSelectedItem(null);
    setMessage(null);
    setError(null);
  }, []);

  const handleRequestDelete = useCallback((item: PolicyGoalItem) => {
    if (!canManage) {
      return;
    }
    setDeleteTarget({
      _id: item._id,
      policyTitle: item.policyTitle,
      year: item.year,
      revisionNo: item.revisionNo,
    });
    setMessage(null);
    setError(null);
  }, [canManage]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const endpoint = editingId ? `/api/qa/policy-goals/${editingId}` : "/api/qa/policy-goals";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: Number(form.year),
          status: form.status,
          policyTitle: form.policyTitle,
          policyStatement: form.policyStatement,
          effectiveDate: form.effectiveDate,
          revisionNo: Number(form.revisionNo),
          goals: form.goals.map((goal) => ({
            goalId: goal.goalId,
            title: goal.title,
            metricName: goal.metricName,
            unit: goal.unit,
            targetValue: goal.targetValue,
            measurementCycle: goal.measurementCycle,
            ownerName: goal.ownerName,
            ownerMemberId: goal.ownerMemberId,
            note: goal.note,
          })),
        }),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "품질 정책·목표 저장 실패");
      }

      setMessage(editingId ? "품질 정책·목표가 수정되었습니다." : "품질 정책·목표가 등록되었습니다.");
      resetForm();
      await loadItems(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "품질 정책·목표 저장 실패");
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
      const response = await fetch(`/api/qa/policy-goals/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "품질 정책·목표 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        resetForm();
      }
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
      setDeleteTarget(null);
      setMessage("품질 정책·목표가 삭제되었습니다.");
      await loadItems(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "품질 정책·목표 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo<DataTableColumn<PolicyGoalItem>[]>(
    () => [
      {
        key: "year",
        header: "연도/개정",
        className: "w-28 align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.year}년</p>
            <p className="text-xs text-foreground-muted">Rev.{row.revisionNo}</p>
          </div>
        ),
      },
      {
        key: "policyTitle",
        header: "품질 방침",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.policyTitle}</p>
            <p className="whitespace-pre-wrap text-xs leading-5 text-foreground-muted">
              {truncateText(row.policyStatement, 120)}
            </p>
          </div>
        ),
      },
      {
        key: "goals",
        header: "목표 요약",
        className: "min-w-[260px] align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            {row.goals.slice(0, 2).map((goal) => (
              <div key={goal.goalId} className="rounded-md bg-background-soft px-2 py-1">
                <p className="text-xs font-medium text-foreground">{goal.title}</p>
                <p className="text-xs text-foreground-muted">
                  {goal.metricName} · {goal.targetValue}
                  {goal.unit ? ` ${goal.unit}` : ""}
                </p>
              </div>
            ))}
            {row.goals.length > 2 ? (
              <p className="text-xs text-foreground-muted">외 {row.goals.length - 2}건</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "status",
        header: "상태",
        className: "w-24",
        render: (value) => <StatusPill status={value as QaPolicyGoalStatus} />,
      },
      {
        key: "effectiveDate",
        header: "시행일",
        className: "w-28",
        render: (value) => formatDate(String(value ?? "")),
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
        <h1 className="mt-2 text-2xl font-semibold text-foreground">품질 정책·목표</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          현장 품질방침과 연간 목표, 핵심 지표 목표치를 한 화면에서 관리합니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/qa/assurance-plan"
            className="inline-flex rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-card"
          >
            QAP 화면 이동
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex rounded-md border border-border bg-background-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
          >
            대시보드 이동
          </Link>
        </div>
      </header>

      <QaFilterPanel
        description="적용연도와 상태 기준으로 품질 정책과 목표를 빠르게 조회합니다."
        actions={
          <>
            <button
              type="button"
              onClick={() => void loadItems(1)}
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
            options={POLICY_GOAL_SORT_OPTIONS}
            onChange={(value) => setSortBy(value as PolicyGoalSort)}
          />
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.6fr_180px_180px]">
          <FormInput
            label="검색어"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="방침 제목, 내용, 목표명, 지표명, 담당자"
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
              onChange={(event) => setStatusFilter(event.target.value as "all" | QaPolicyGoalStatus)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_POLICY_GOAL_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {QA_POLICY_GOAL_STATUS_LABELS[status]}
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
                {editingId ? "품질 정책·목표 수정" : "품질 정책·목표 등록"}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                정책 문구와 목표 항목을 함께 저장합니다.
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

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void handleLoadPreviousYearGoals()}
              disabled={isCopyingPrevious}
              className="rounded-md border border-border bg-background-card px-4 py-2 text-sm font-medium text-foreground hover:bg-background-soft disabled:opacity-60"
            >
              {isCopyingPrevious ? "불러오는 중..." : "전년도 기준 가져오기"}
            </button>
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
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">상태</span>
              <select
                value={form.status}
                onChange={(event) => updateFormField("status", event.target.value as QaPolicyGoalStatus)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_POLICY_GOAL_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {QA_POLICY_GOAL_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <FormInput
              label="시행일"
              type="date"
              value={form.effectiveDate}
              onChange={(event) => updateFormField("effectiveDate", event.target.value)}
            />
            <FormInput
              label="개정번호"
              value={form.revisionNo}
              onChange={(event) =>
                updateFormField("revisionNo", event.target.value.replace(/[^0-9]/g, "").slice(0, 2))
              }
              required
              inputMode="numeric"
            />
          </div>

          <FormInput
            label="품질방침 제목"
            value={form.policyTitle}
            onChange={(event) => updateFormField("policyTitle", event.target.value)}
            required
          />

          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">품질방침 내용</span>
            <textarea
              value={form.policyStatement}
              onChange={(event) => updateFormField("policyStatement", event.target.value)}
              rows={4}
              required
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="현장 품질방침과 운영 원칙을 입력하세요."
            />
          </label>

          <div className="space-y-3 rounded-xl border border-border bg-background-soft p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">목표 항목</h3>
                <p className="mt-1 text-xs text-foreground-muted">
                  목표명, 지표, 목표치, 측정주기, 담당자를 설정합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddGoalRow}
                className="rounded-md border border-border bg-background-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
              >
                목표 추가
              </button>
            </div>

            <div className="space-y-3">
              {form.goals.map((goal, index) => {
                const selectedOwner = goal.ownerMemberId ? memberOptionById.get(goal.ownerMemberId) ?? null : null;
                return (
                  <div key={goal.goalId} className="rounded-lg border border-border bg-background-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">목표 {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveGoalRow(goal.goalId)}
                        disabled={form.goals.length === 1}
                        className="rounded-md border border-border px-3 py-1 text-xs text-foreground-muted hover:bg-background-soft disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <FormInput
                        label="목표명"
                        value={goal.title}
                        onChange={(event) => updateGoalField(goal.goalId, "title", event.target.value)}
                        required
                      />
                      <FormInput
                        label="지표명"
                        value={goal.metricName}
                        onChange={(event) => updateGoalField(goal.goalId, "metricName", event.target.value)}
                        required
                      />
                      <FormInput
                        label="목표치"
                        value={goal.targetValue}
                        onChange={(event) => updateGoalField(goal.goalId, "targetValue", event.target.value)}
                        required
                      />
                      <FormInput
                        label="단위"
                        value={goal.unit}
                        onChange={(event) => updateGoalField(goal.goalId, "unit", event.target.value)}
                        placeholder="% / 건 / 점"
                      />
                      <label className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">측정주기</span>
                        <select
                          value={goal.measurementCycle}
                          onChange={(event) =>
                            updateGoalField(
                              goal.goalId,
                              "measurementCycle",
                              event.target.value as QaMeasurementCycle,
                            )
                          }
                          className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                        >
                          {QA_MEASUREMENT_CYCLE_VALUES.map((cycle) => (
                            <option key={cycle} value={cycle}>
                              {QA_MEASUREMENT_CYCLE_LABELS[cycle]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="space-y-1">
                        <span className="block text-sm font-medium text-foreground">담당자</span>
                        <div className="flex flex-col gap-2 md:flex-row">
                          <input
                            readOnly
                            value={formatSiteMemberSummary(selectedOwner, goal.ownerName)}
                            placeholder="현장 인력에서 선택"
                            className="h-9 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() => handleOpenOwnerPicker(goal.goalId)}
                            className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                          >
                            사용자 선택
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClearOwner(goal.goalId)}
                            className="rounded-md border border-border bg-background-card px-3 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                          >
                            초기화
                          </button>
                        </div>
                      </div>
                      <label className="space-y-1 lg:col-span-2">
                        <span className="block text-sm font-medium text-foreground">비고</span>
                        <textarea
                          value={goal.note}
                          onChange={(event) => updateGoalField(goal.goalId, "note", event.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                          placeholder="산식, 산출 기준, 특이사항"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
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

      <DataTable<PolicyGoalItem>
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "품질 정책·목표를 불러오는 중입니다." : "등록된 품질 정책·목표가 없습니다."}
        onRowClick={(row) => setSelectedItem(row)}
        getRowAriaLabel={(row) => `${row.year}년 ${row.policyTitle} 상세 보기`}
      />

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadItems(nextPage)} />
      ) : null}

      <Modal
        open={selectedItem !== null}
        title="품질 정책·목표 상세"
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
                <p className="text-xs font-medium text-foreground-muted">개정번호</p>
                <p className="mt-1 text-foreground">Rev.{selectedItem.revisionNo}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">상태</p>
                <div className="mt-1">
                  <StatusPill status={selectedItem.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">시행일</p>
                <p className="mt-1 text-foreground">{formatDate(selectedItem.effectiveDate)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">품질방침 제목</p>
              <p className="mt-1 font-medium text-foreground">{selectedItem.policyTitle}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">품질방침 내용</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.policyStatement}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground-muted">목표 항목</p>
              {selectedItem.goals.map((goal) => (
                <div key={goal.goalId} className="rounded-lg border border-border bg-background-soft p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{goal.title}</p>
                    <span className="text-xs text-foreground-muted">
                      {QA_MEASUREMENT_CYCLE_LABELS[goal.measurementCycle]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    {goal.metricName} / {goal.targetValue}
                    {goal.unit ? ` ${goal.unit}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    담당자: {goal.ownerName || "미지정"}
                  </p>
                  {goal.note ? (
                    <p className="mt-2 text-xs leading-5 text-foreground-muted">{goal.note}</p>
                  ) : null}
                </div>
              ))}
            </div>

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
        title="품질 정책·목표 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              아래 품질 정책·목표를 삭제하시겠습니까?
            </p>
            <div className="rounded-lg border border-border bg-background-soft p-3 text-sm text-foreground">
              <p className="font-medium">{deleteTarget.policyTitle}</p>
              <p className="mt-1 text-foreground-muted">
                {deleteTarget.year}년 · Rev.{deleteTarget.revisionNo}
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
        open={ownerPickerGoalId !== null}
        title="담당자 선택"
        onClose={() => setOwnerPickerGoalId(null)}
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
