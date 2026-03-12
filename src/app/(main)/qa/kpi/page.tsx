"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QaFeedbackBanners } from "@/components/qa/feedback-banners";
import { QaFilterPanel } from "@/components/qa/filter-panel";
import { QaSortSelect } from "@/components/qa/sort-select";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable, FormInput, Modal, Pagination } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import {
  formatSiteMemberSummary,
  type SiteMemberOption,
  useSiteMembers,
} from "@/hooks/use-site-members";
import {
  QA_KPI_CYCLE_LABELS,
  QA_KPI_CYCLE_VALUES,
  QA_KPI_SOURCE_METRIC_LABELS,
  QA_KPI_SOURCE_METRIC_VALUES,
  QA_KPI_TARGET_DIRECTION_LABELS,
  QA_KPI_TARGET_DIRECTION_VALUES,
  calculateQaKpiAchievementRate,
  getDefaultQaKpiDirection,
  getDefaultQaKpiUnit,
  mapPolicyGoalCycleToQaKpiCycle,
  type QaKpiCycle,
  type QaKpiSourceMetric,
  type QaKpiTargetDirection,
} from "@/lib/qa-kpi";
import type { QaMeasurementCycle } from "@/lib/qa-policy-goals";

type PolicyGoalOption = {
  key: string;
  policyGoalId: string;
  year: number;
  policyTitle: string;
  policyStatus: string;
  goalId: string;
  goalTitle: string;
  metricName: string;
  targetValue: string;
  unit: string;
  measurementCycle: QaMeasurementCycle;
  ownerName: string;
  ownerMemberId: string;
};

type KpiTrendPoint = {
  key: string;
  label: string;
  actualValue: number;
  targetValue: number;
  achievementRate: number;
  isAlert: boolean;
};

type KpiItem = {
  _id: string;
  metricCode: string;
  metricName: string;
  sourceMetric: QaKpiSourceMetric;
  measurementCycle: QaKpiCycle;
  unit: string;
  targetDirection: QaKpiTargetDirection;
  targetValue: number;
  warningThreshold?: number | null;
  linkedPolicyGoalId: string;
  linkedPolicyGoalYear?: number | null;
  linkedPolicyGoalTitle: string;
  linkedPolicyGoalGoalId: string;
  linkedPolicyGoalMetricName: string;
  ownerName: string;
  ownerMemberId: string;
  description: string;
  isActive: boolean;
  currentPeriodLabel: string;
  currentValue: number;
  achievementRate: number;
  isAlert: boolean;
  alertMessage: string;
  trend: KpiTrendPoint[];
  createdAt: string;
  updatedAt: string;
  actions?: string;
};

type KpiSummaryMeta = {
  year: number;
  definitionCount: number;
  activeCount: number;
  alertCount: number;
  linkedPolicyGoalCount: number;
  averageAchievementRate: number;
};

type KpiSummaryResponse = {
  ok: boolean;
  data: KpiItem[];
  meta?: {
    page: number;
    totalPages: number;
    total: number;
    summary?: KpiSummaryMeta;
    alerts?: KpiItem[];
  };
  error?: string;
};

type KpiOptionsResponse = {
  ok: boolean;
  data?: {
    policyGoalOptions: PolicyGoalOption[];
  };
  error?: string;
};

type KpiForm = {
  metricCode: string;
  metricName: string;
  sourceMetric: QaKpiSourceMetric;
  measurementCycle: QaKpiCycle;
  unit: string;
  targetDirection: QaKpiTargetDirection;
  targetValue: string;
  warningThreshold: string;
  linkedPolicyGoalId: string;
  linkedPolicyGoalYear: string;
  linkedPolicyGoalTitle: string;
  linkedPolicyGoalGoalId: string;
  linkedPolicyGoalMetricName: string;
  ownerName: string;
  ownerMemberId: string;
  description: string;
  isActive: boolean;
};

type DeleteTarget = Pick<KpiItem, "_id" | "metricCode" | "metricName">;
type KpiSort = "alert_first" | "achievement_desc" | "achievement_asc" | "metric_code";

const KPI_SORT_OPTIONS: Array<{ value: KpiSort; label: string }> = [
  { value: "alert_first", label: "경고 우선" },
  { value: "achievement_desc", label: "달성률 높은순" },
  { value: "achievement_asc", label: "달성률 낮은순" },
  { value: "metric_code", label: "KPI 코드순" },
];

function createEmptyForm(): KpiForm {
  const sourceMetric: QaKpiSourceMetric = "audit_nonconformity_count";
  return {
    metricCode: "",
    metricName: "",
    sourceMetric,
    measurementCycle: "monthly",
    unit: getDefaultQaKpiUnit(sourceMetric),
    targetDirection: getDefaultQaKpiDirection(sourceMetric),
    targetValue: "",
    warningThreshold: "",
    linkedPolicyGoalId: "",
    linkedPolicyGoalYear: "",
    linkedPolicyGoalTitle: "",
    linkedPolicyGoalGoalId: "",
    linkedPolicyGoalMetricName: "",
    ownerName: "",
    ownerMemberId: "",
    description: "",
    isActive: true,
  };
}

function formatMetricValue(value: number, unit: string) {
  const formatted = value.toLocaleString("ko-KR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  });
  if (!unit) {
    return formatted;
  }
  if (unit === "%") {
    return `${formatted}%`;
  }
  return `${formatted} ${unit}`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 10);
}

function buildPolicyGoalOptionLabel(item: PolicyGoalOption) {
  return `${item.year}년 · ${item.metricName} · 목표 ${item.targetValue}${item.unit ? ` ${item.unit}` : ""}`;
}

function ActivePill({ isActive }: { isActive: boolean }) {
  const toneClass = isActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {isActive ? "운영중" : "중지"}
    </span>
  );
}

function AlertPill({ isAlert }: { isAlert: boolean }) {
  const toneClass = isAlert
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {isAlert ? "경고" : "정상"}
    </span>
  );
}

export default function QaKpiPage() {
  const { user } = useCurrentUser();
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

  const [items, setItems] = useState<KpiItem[]>([]);
  const [policyGoalOptions, setPolicyGoalOptions] = useState<PolicyGoalOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [sourceMetricFilter, setSourceMetricFilter] = useState<"all" | QaKpiSourceMetric>("all");
  const [cycleFilter, setCycleFilter] = useState<"all" | QaKpiCycle>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [alertOnly, setAlertOnly] = useState(false);
  const [sortBy, setSortBy] = useState<KpiSort>("alert_first");
  const [summary, setSummary] = useState<KpiSummaryMeta>({
    year: new Date().getFullYear(),
    definitionCount: 0,
    activeCount: 0,
    alertCount: 0,
    linkedPolicyGoalCount: 0,
    averageAchievementRate: 0,
  });
  const [alerts, setAlerts] = useState<KpiItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptionLoading, setIsOptionLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KpiForm>(() => createEmptyForm());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<KpiItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isOwnerPickerOpen, setIsOwnerPickerOpen] = useState(false);

  const policyGoalOptionByKey = useMemo(() => {
    return new Map(policyGoalOptions.map((item) => [item.key, item]));
  }, [policyGoalOptions]);

  const selectedPolicyGoalKey = useMemo(() => {
    if (!form.linkedPolicyGoalId || !form.linkedPolicyGoalGoalId) {
      return "";
    }
    return `${form.linkedPolicyGoalId}:${form.linkedPolicyGoalGoalId}`;
  }, [form.linkedPolicyGoalGoalId, form.linkedPolicyGoalId]);

  const loadItems = useCallback(
    async (nextPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          limit: "10",
          q: keyword,
          year: yearFilter.trim(),
          sourceMetric: sourceMetricFilter,
          cycle: cycleFilter,
          active: activeFilter,
          alertOnly: String(alertOnly),
          sort: sortBy,
        });

        const response = await fetch(`/api/qa/kpi/summary?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as KpiSummaryResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "품질 KPI 조회 실패");
        }

        setItems(Array.isArray(result.data) ? result.data : []);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
        setSummary(result.meta?.summary ?? {
          year: Number(yearFilter) || new Date().getFullYear(),
          definitionCount: 0,
          activeCount: 0,
          alertCount: 0,
          linkedPolicyGoalCount: 0,
          averageAchievementRate: 0,
        });
        setAlerts(Array.isArray(result.meta?.alerts) ? result.meta?.alerts : []);
      } catch (err) {
        setItems([]);
        setSummary({
          year: Number(yearFilter) || new Date().getFullYear(),
          definitionCount: 0,
          activeCount: 0,
          alertCount: 0,
          linkedPolicyGoalCount: 0,
          averageAchievementRate: 0,
        });
        setAlerts([]);
        setError(err instanceof Error ? err.message : "품질 KPI 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [activeFilter, alertOnly, cycleFilter, keyword, sortBy, sourceMetricFilter, yearFilter],
  );

  const loadOptions = useCallback(async () => {
    if (!canManage) {
      setPolicyGoalOptions([]);
      return;
    }

    setIsOptionLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/qa/kpi/options", { cache: "no-store" });
      const result = (await response.json()) as KpiOptionsResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "KPI 옵션 조회 실패");
      }

      setPolicyGoalOptions(Array.isArray(result.data?.policyGoalOptions) ? result.data?.policyGoalOptions : []);
    } catch (err) {
      setPolicyGoalOptions([]);
      setError(err instanceof Error ? err.message : "KPI 옵션 조회 실패");
    } finally {
      setIsOptionLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void loadItems(1);
  }, [loadItems]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  function resetFilters() {
    setKeyword("");
    setYearFilter(String(new Date().getFullYear()));
    setSourceMetricFilter("all");
    setCycleFilter("all");
    setActiveFilter("all");
    setAlertOnly(false);
    setSortBy("alert_first");
    void loadItems(1);
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setIsOwnerPickerOpen(false);
    setMemberQuery("");
  }

  function updateFormField<K extends keyof KpiForm>(field: K, value: KpiForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSourceMetricChange(nextMetric: QaKpiSourceMetric) {
    setForm((current) => ({
      ...current,
      sourceMetric: nextMetric,
      unit: current.linkedPolicyGoalId && current.unit ? current.unit : getDefaultQaKpiUnit(nextMetric),
      targetDirection: getDefaultQaKpiDirection(nextMetric),
    }));
  }

  function handlePolicyGoalChange(nextKey: string) {
    if (!nextKey) {
      setForm((current) => ({
        ...current,
        linkedPolicyGoalId: "",
        linkedPolicyGoalYear: "",
        linkedPolicyGoalTitle: "",
        linkedPolicyGoalGoalId: "",
        linkedPolicyGoalMetricName: "",
      }));
      return;
    }

    const option = policyGoalOptionByKey.get(nextKey);
    if (!option) {
      return;
    }

    setForm((current) => ({
      ...current,
      metricName: current.metricName || option.metricName,
      measurementCycle: mapPolicyGoalCycleToQaKpiCycle(option.measurementCycle),
      unit: option.unit || getDefaultQaKpiUnit(current.sourceMetric),
      targetValue: option.targetValue || current.targetValue,
      linkedPolicyGoalId: option.policyGoalId,
      linkedPolicyGoalYear: String(option.year),
      linkedPolicyGoalTitle: option.policyTitle,
      linkedPolicyGoalGoalId: option.goalId,
      linkedPolicyGoalMetricName: option.metricName,
      ownerName: option.ownerName || current.ownerName,
      ownerMemberId: option.ownerMemberId || current.ownerMemberId,
    }));
  }

  function handleOpenOwnerPicker() {
    setMemberQuery("");
    setIsOwnerPickerOpen(true);
  }

  function handleSelectOwner(member: SiteMemberOption) {
    setForm((current) => ({
      ...current,
      ownerName: member.name,
      ownerMemberId: member._id,
    }));
    setIsOwnerPickerOpen(false);
  }

  function handleClearOwner() {
    setForm((current) => ({
      ...current,
      ownerName: "",
      ownerMemberId: "",
    }));
  }

  const handleEdit = useCallback((item: KpiItem) => {
    if (!canManage) {
      return;
    }

    setEditingId(item._id);
    setForm({
      metricCode: item.metricCode,
      metricName: item.metricName,
      sourceMetric: item.sourceMetric,
      measurementCycle: item.measurementCycle,
      unit: item.unit,
      targetDirection: item.targetDirection,
      targetValue: String(item.targetValue ?? ""),
      warningThreshold:
        item.warningThreshold === null || item.warningThreshold === undefined
          ? ""
          : String(item.warningThreshold),
      linkedPolicyGoalId: item.linkedPolicyGoalId,
      linkedPolicyGoalYear: item.linkedPolicyGoalYear ? String(item.linkedPolicyGoalYear) : "",
      linkedPolicyGoalTitle: item.linkedPolicyGoalTitle,
      linkedPolicyGoalGoalId: item.linkedPolicyGoalGoalId,
      linkedPolicyGoalMetricName: item.linkedPolicyGoalMetricName,
      ownerName: item.ownerName,
      ownerMemberId: item.ownerMemberId,
      description: item.description,
      isActive: item.isActive,
    });
    setSelectedItem(null);
    setDeleteTarget(null);
    setMessage(null);
    setError(null);
  }, [canManage]);

  const handleRequestDelete = useCallback((item: KpiItem) => {
    if (!canManage) {
      return;
    }

    setDeleteTarget({
      _id: item._id,
      metricCode: item.metricCode,
      metricName: item.metricName,
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
      const endpoint = editingId ? `/api/qa/kpi/${editingId}` : "/api/qa/kpi";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricCode: form.metricCode.trim().toUpperCase(),
          metricName: form.metricName,
          sourceMetric: form.sourceMetric,
          measurementCycle: form.measurementCycle,
          unit: form.unit,
          targetDirection: form.targetDirection,
          targetValue: form.targetValue,
          warningThreshold: form.warningThreshold,
          linkedPolicyGoalId: form.linkedPolicyGoalId,
          linkedPolicyGoalYear: form.linkedPolicyGoalYear,
          linkedPolicyGoalTitle: form.linkedPolicyGoalTitle,
          linkedPolicyGoalGoalId: form.linkedPolicyGoalGoalId,
          linkedPolicyGoalMetricName: form.linkedPolicyGoalMetricName,
          ownerName: form.ownerName,
          ownerMemberId: form.ownerMemberId,
          description: form.description,
          isActive: form.isActive,
        }),
      });

      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "품질 KPI 저장 실패");
      }

      setMessage(editingId ? "품질 KPI가 수정되었습니다." : "품질 KPI가 등록되었습니다.");
      resetForm();
      await loadItems(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "품질 KPI 저장 실패");
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
      const response = await fetch(`/api/qa/kpi/${deleteTarget._id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "품질 KPI 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        resetForm();
      }
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
      setDeleteTarget(null);
      setMessage("품질 KPI가 삭제되었습니다.");
      await loadItems(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "품질 KPI 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo<DataTableColumn<KpiItem>[]>(() => {
    const nextColumns: DataTableColumn<KpiItem>[] = [
      {
        key: "metricName",
        header: "KPI",
        className: "min-w-[220px] align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.metricName}</p>
            <p className="text-xs text-foreground-muted">{row.metricCode}</p>
            {row.description ? (
              <p className="line-clamp-2 text-xs leading-5 text-foreground-muted">{row.description}</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "sourceMetric",
        header: "기준/연결",
        className: "min-w-[220px] align-top",
        render: (value, row) => (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {QA_KPI_SOURCE_METRIC_LABELS[value as QaKpiSourceMetric]}
            </p>
            <p className="text-xs text-foreground-muted">
              {QA_KPI_CYCLE_LABELS[row.measurementCycle]} · {QA_KPI_TARGET_DIRECTION_LABELS[row.targetDirection]}
            </p>
            {row.linkedPolicyGoalId ? (
              <div className="rounded-md bg-background-soft px-2 py-1">
                <p className="text-xs font-medium text-foreground">
                  {row.linkedPolicyGoalYear ? `${row.linkedPolicyGoalYear}년 ` : ""}
                  {row.linkedPolicyGoalMetricName || row.linkedPolicyGoalTitle}
                </p>
                <p className="text-xs text-foreground-muted">{row.linkedPolicyGoalTitle}</p>
              </div>
            ) : (
              <p className="text-xs text-foreground-muted">직접 정의 KPI</p>
            )}
          </div>
        ),
      },
      {
        key: "currentValue",
        header: "현재 실적",
        className: "w-44 align-top",
        render: (value, row) => (
          <div className="space-y-1">
            <p className={`text-base font-semibold ${row.isAlert ? "text-danger" : "text-foreground"}`}>
              {formatMetricValue(Number(value ?? 0), row.unit)}
            </p>
            <p className="text-xs text-foreground-muted">{row.currentPeriodLabel}</p>
            <p className="text-xs text-foreground-muted">달성률 {row.achievementRate.toFixed(1)}%</p>
          </div>
        ),
      },
      {
        key: "targetValue",
        header: "목표/경고",
        className: "w-44 align-top",
        render: (value, row) => (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              목표 {formatMetricValue(Number(value ?? 0), row.unit)}
            </p>
            <p className="text-xs text-foreground-muted">
              경고 {formatMetricValue(Number(row.warningThreshold ?? row.targetValue), row.unit)}
            </p>
            <p className="text-xs text-foreground-muted">{QA_KPI_TARGET_DIRECTION_LABELS[row.targetDirection]}</p>
          </div>
        ),
      },
      {
        key: "isActive",
        header: "상태",
        className: "w-32 align-top",
        render: (_value, row) => (
          <div className="flex flex-col gap-1">
            <ActivePill isActive={row.isActive} />
            <AlertPill isAlert={row.isAlert} />
          </div>
        ),
      },
      {
        key: "ownerName",
        header: "담당",
        className: "w-40 align-top",
        render: (value, row) => (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{String(value || "미지정")}</p>
            <p className="text-xs text-foreground-muted">수정일 {formatDate(row.updatedAt)}</p>
          </div>
        ),
      },
    ];

    if (canManage) {
      nextColumns.push({
        key: "actions",
        header: "작업",
        className: "w-36",
        render: (_value, row) => (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedItem(row);
              }}
              className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
            >
              상세
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleEdit(row);
              }}
              className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
            >
              수정
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleRequestDelete(row);
              }}
              className="rounded-md border border-danger/30 px-2 py-1 text-xs text-danger hover:bg-danger/5"
            >
              삭제
            </button>
          </div>
        ),
      });
    }

    return nextColumns;
  }, [canManage, handleEdit, handleRequestDelete]);

  const selectedOwner = form.ownerMemberId ? memberOptionById.get(form.ownerMemberId) ?? null : null;
  const selectedPolicyGoalDescription =
    form.linkedPolicyGoalTitle && form.linkedPolicyGoalMetricName
      ? `${form.linkedPolicyGoalTitle} · ${form.linkedPolicyGoalMetricName}`
      : "";

  return (
    <section className="space-y-4 rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">품질 KPI</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            정책 목표와 심사, CAPA, 협력사 평가 데이터를 묶어 월/분기/연간 품질 성과를 추적합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/qa/policy-goals"
            className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background-card"
          >
            정책 목표 보기
          </Link>
          <button
            type="button"
            onClick={() => void loadItems(page)}
            className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm text-foreground hover:bg-background-card"
          >
            새로고침
          </button>
        </div>
      </header>

      <QaFeedbackBanners message={message} error={error} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">정의 수</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {summary.definitionCount.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">운영중 KPI</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {summary.activeCount.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">경고 KPI</p>
          <p className="mt-2 text-2xl font-semibold text-danger">
            {summary.alertCount.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">정책 목표 연계</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {summary.linkedPolicyGoalCount.toLocaleString("ko-KR")}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background-soft p-3">
          <p className="text-xs text-foreground-muted">{summary.year}년 평균 달성률</p>
          <p className="mt-2 text-2xl font-semibold text-success">
            {summary.averageAchievementRate.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-background-soft p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">임계치 경고</h2>
            <p className="mt-1 text-xs text-foreground-muted">
              경고 기준을 벗어난 KPI {summary.alertCount}건
            </p>
          </div>
          {alertOnly ? (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
              경고 필터 적용 중
            </span>
          ) : null}
        </div>
        <div className="mt-3 space-y-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              현재 필터 기준으로 경고 KPI가 없습니다.
            </p>
          ) : (
            alerts.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="flex w-full items-start justify-between gap-3 rounded-lg border border-rose-200 bg-background-card px-3 py-2 text-left hover:bg-rose-50/40"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.metricName} <span className="text-xs text-foreground-muted">({item.metricCode})</span>
                  </p>
                  <p className="mt-1 text-xs text-rose-700">{item.alertMessage}</p>
                </div>
                <span className="text-xs text-foreground-muted">{item.currentPeriodLabel}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <QaFilterPanel
            description="연도, 집계 지표, 주기 기준으로 KPI 성과를 정리하고 경고 항목만 빠르게 모아볼 수 있습니다."
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <QaSortSelect
                    compact
                    value={sortBy}
                    options={KPI_SORT_OPTIONS}
                    onChange={(value) => setSortBy(value as KpiSort)}
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={alertOnly}
                      onChange={(event) => setAlertOnly(event.target.checked)}
                      className="h-4 w-4 rounded border border-border"
                    />
                    경고 항목만 보기
                  </label>
                </div>
                <p className="text-xs text-foreground-muted">
                  KPI 정의와 현재 기간 실적은 {summary.year}년 기준으로 집계됩니다.
                </p>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <FormInput
                label="검색"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="KPI 코드, KPI 명, 담당자"
                wrapperClassName="xl:col-span-2"
              />
              <FormInput
                label="기준연도"
                type="number"
                min={2000}
                max={2100}
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">집계 지표</label>
                <select
                  value={sourceMetricFilter}
                  onChange={(event) => setSourceMetricFilter(event.target.value as "all" | QaKpiSourceMetric)}
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                >
                  <option value="all">전체</option>
                  {QA_KPI_SOURCE_METRIC_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {QA_KPI_SOURCE_METRIC_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">주기</label>
                <select
                  value={cycleFilter}
                  onChange={(event) => setCycleFilter(event.target.value as "all" | QaKpiCycle)}
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                >
                  <option value="all">전체</option>
                  {QA_KPI_CYCLE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {QA_KPI_CYCLE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">운영 상태</label>
                <select
                  value={activeFilter}
                  onChange={(event) =>
                    setActiveFilter(event.target.value as "all" | "active" | "inactive")
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                >
                  <option value="all">전체</option>
                  <option value="active">운영중</option>
                  <option value="inactive">중지</option>
                </select>
              </div>
            </div>
          </QaFilterPanel>

          <DataTable<KpiItem>
            columns={columns}
            data={items}
            rowKey={(row) => row._id}
            emptyMessage={isLoading ? "불러오는 중..." : "등록된 KPI가 없습니다."}
            onRowClick={(row) => setSelectedItem(row)}
            getRowAriaLabel={(row) => `${row.metricName} 상세 보기`}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-foreground-muted">
              {summary.definitionCount}건 중 현재 페이지 {page}
            </p>
            <Pagination page={page} totalPages={Math.max(totalPages, 1)} onPageChange={(nextPage) => void loadItems(nextPage)} />
          </div>
        </div>

        {canManage ? (
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="space-y-4 rounded-xl border border-border bg-background-soft p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {editingId ? "KPI 수정" : "KPI 등록"}
                </h2>
                <p className="mt-1 text-xs text-foreground-muted">
                  목표값, 경고 기준, 정책 목표 연계를 같이 관리합니다.
                </p>
              </div>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-background-card"
                >
                  신규로 전환
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormInput
                label="KPI 코드"
                value={form.metricCode}
                onChange={(event) => updateFormField("metricCode", event.target.value.toUpperCase())}
                placeholder="QA_AUDIT_NC"
              />
              <FormInput
                label="KPI 명"
                value={form.metricName}
                onChange={(event) => updateFormField("metricName", event.target.value)}
                placeholder="월간 부적합 건수"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">정책 목표 연결</label>
              <select
                value={selectedPolicyGoalKey}
                onChange={(event) => handlePolicyGoalChange(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              >
                <option value="">직접 설정</option>
                {policyGoalOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {buildPolicyGoalOptionLabel(item)}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between gap-3 text-xs text-foreground-muted">
                <p>{selectedPolicyGoalDescription || "정책 목표를 연결하면 목표치/주기/담당자를 기본값으로 반영합니다."}</p>
                <Link href="/qa/policy-goals" className="text-foreground underline-offset-2 hover:underline">
                  정책 목표 관리
                </Link>
              </div>
              {isOptionLoading ? <p className="text-xs text-foreground-muted">정책 목표 불러오는 중...</p> : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">집계 지표</label>
                <select
                  value={form.sourceMetric}
                  onChange={(event) => handleSourceMetricChange(event.target.value as QaKpiSourceMetric)}
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                >
                  {QA_KPI_SOURCE_METRIC_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {QA_KPI_SOURCE_METRIC_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">주기</label>
                <select
                  value={form.measurementCycle}
                  onChange={(event) => updateFormField("measurementCycle", event.target.value as QaKpiCycle)}
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                >
                  {QA_KPI_CYCLE_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {QA_KPI_CYCLE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <FormInput
                label="단위"
                value={form.unit}
                onChange={(event) => updateFormField("unit", event.target.value)}
                placeholder="% 또는 건"
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-foreground">목표 방향</label>
                <select
                  value={form.targetDirection}
                  onChange={(event) =>
                    updateFormField("targetDirection", event.target.value as QaKpiTargetDirection)
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                >
                  {QA_KPI_TARGET_DIRECTION_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {QA_KPI_TARGET_DIRECTION_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <FormInput
                label="목표값"
                type="number"
                min={0}
                step="0.1"
                value={form.targetValue}
                onChange={(event) => updateFormField("targetValue", event.target.value)}
                placeholder="0"
              />
              <FormInput
                label="경고 기준"
                type="number"
                min={0}
                step="0.1"
                value={form.warningThreshold}
                onChange={(event) => updateFormField("warningThreshold", event.target.value)}
                placeholder="비우면 목표값 사용"
              />
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-background-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">담당자</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    현장 배치 인력 중에서 선택합니다.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleOpenOwnerPicker}
                    className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                  >
                    담당자 선택
                  </button>
                  <button
                    type="button"
                    onClick={handleClearOwner}
                    className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-background-soft"
                  >
                    지우기
                  </button>
                </div>
              </div>
              <div className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-foreground">
                {selectedOwner
                  ? formatSiteMemberSummary(selectedOwner)
                  : form.ownerName || "담당자가 지정되지 않았습니다."}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-foreground">설명</label>
              <textarea
                value={form.description}
                onChange={(event) => updateFormField("description", event.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                placeholder="집계 목적, 보고 대상, 주의사항"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateFormField("isActive", event.target.checked)}
                className="h-4 w-4 rounded border border-border"
              />
              운영중 KPI로 사용
            </label>

            <div className="rounded-lg border border-border bg-background-card p-3">
              <p className="text-xs text-foreground-muted">미리보기</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                달성률{" "}
                {calculateQaKpiAchievementRate(
                  Number(form.warningThreshold || form.targetValue || 0),
                  Number(form.targetValue || 0),
                  form.targetDirection,
                ).toFixed(1)}
                %
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                목표 {form.targetValue || "0"} {form.unit}
                {form.warningThreshold ? ` · 경고 ${form.warningThreshold} ${form.unit}` : ""}
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "저장 중..." : editingId ? "KPI 수정" : "KPI 등록"}
            </button>
          </form>
        ) : (
          <div className="rounded-xl border border-border bg-background-soft p-4">
            <h2 className="text-sm font-semibold text-foreground">관리 권한 안내</h2>
            <p className="mt-2 text-sm leading-6 text-foreground-muted">
              KPI 등록과 수정은 `manager` 이상 권한에서 가능합니다. 현재 화면에서는 KPI 추이와 경고 상태를 조회할 수 있습니다.
            </p>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(selectedItem)}
        title={selectedItem ? `${selectedItem.metricCode} 상세` : "품질 KPI 상세"}
        onClose={() => setSelectedItem(null)}
      >
        {selectedItem ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-background-soft p-3">
                <p className="text-xs text-foreground-muted">현재 실적</p>
                <p className={`mt-2 text-lg font-semibold ${selectedItem.isAlert ? "text-danger" : "text-foreground"}`}>
                  {formatMetricValue(selectedItem.currentValue, selectedItem.unit)}
                </p>
                <p className="mt-1 text-xs text-foreground-muted">{selectedItem.currentPeriodLabel}</p>
              </div>
              <div className="rounded-lg border border-border bg-background-soft p-3">
                <p className="text-xs text-foreground-muted">목표 / 경고</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {formatMetricValue(selectedItem.targetValue, selectedItem.unit)}
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  경고 {formatMetricValue(Number(selectedItem.warningThreshold ?? selectedItem.targetValue), selectedItem.unit)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background-soft p-3">
                <p className="text-xs text-foreground-muted">달성률</p>
                <p className="mt-2 text-lg font-semibold text-success">
                  {selectedItem.achievementRate.toFixed(1)}%
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {QA_KPI_TARGET_DIRECTION_LABELS[selectedItem.targetDirection]}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">추이</h3>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {QA_KPI_CYCLE_LABELS[selectedItem.measurementCycle]} 기준 실제값과 목표값 비교
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ActivePill isActive={selectedItem.isActive} />
                  <AlertPill isAlert={selectedItem.isAlert} />
                </div>
              </div>
              <div className="mt-3 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedItem.trend} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6e5e3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#787774" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#787774" }} />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "달성률") {
                          return `${Number(value ?? 0).toFixed(1)}%`;
                        }
                        return formatMetricValue(Number(value ?? 0), selectedItem.unit);
                      }}
                      labelFormatter={(label) => `${label} 실적`}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e6e5e3",
                        backgroundColor: "#ffffff",
                        color: "#37352f",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="targetValue"
                      name="목표"
                      stroke="#2f76d2"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="actualValue"
                      name="실적"
                      stroke="#b42318"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-background-soft p-3">
                <p className="text-xs text-foreground-muted">연결 정보</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {QA_KPI_SOURCE_METRIC_LABELS[selectedItem.sourceMetric]}
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {QA_KPI_CYCLE_LABELS[selectedItem.measurementCycle]} · {selectedItem.metricCode}
                </p>
                {selectedItem.linkedPolicyGoalId ? (
                  <div className="mt-3 rounded-md border border-border bg-background-card px-3 py-2">
                    <p className="text-xs font-medium text-foreground">
                      {selectedItem.linkedPolicyGoalYear ? `${selectedItem.linkedPolicyGoalYear}년 ` : ""}
                      {selectedItem.linkedPolicyGoalMetricName}
                    </p>
                    <p className="mt-1 text-xs text-foreground-muted">{selectedItem.linkedPolicyGoalTitle}</p>
                    <Link
                      href="/qa/policy-goals"
                      className="mt-2 inline-flex text-xs text-foreground underline-offset-2 hover:underline"
                    >
                      정책 목표 화면으로 이동
                    </Link>
                  </div>
                ) : null}
              </div>
              <div className="rounded-lg border border-border bg-background-soft p-3">
                <p className="text-xs text-foreground-muted">담당 및 메모</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {selectedItem.ownerName || "담당자 미지정"}
                </p>
                <p className="mt-1 text-xs text-foreground-muted">수정일 {formatDate(selectedItem.updatedAt)}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground-muted">
                  {selectedItem.description || "설명 없음"}
                </p>
              </div>
            </div>

            {selectedItem.isAlert ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {selectedItem.alertMessage}
              </div>
            ) : null}

            {canManage ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleEdit(selectedItem)}
                  className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-background-soft"
                >
                  이 KPI 수정
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="품질 KPI 삭제"
        onClose={() => (deletingId ? undefined : setDeleteTarget(null))}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              <span className="font-medium">{deleteTarget.metricName}</span>
              <span className="text-foreground-muted"> ({deleteTarget.metricCode})</span> KPI를 삭제하시겠습니까?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-background-soft"
                disabled={Boolean(deletingId)}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={Boolean(deletingId)}
              >
                {deletingId ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={isOwnerPickerOpen}
        title="담당자 선택"
        onClose={() => setIsOwnerPickerOpen(false)}
      >
        <div className="space-y-3">
          <FormInput
            label="사용자 검색"
            value={memberQuery}
            onChange={(event) => setMemberQuery(event.target.value)}
            placeholder="이름, 이메일, 역할"
          />
          {memberError ? <p className="text-sm text-danger">{memberError}</p> : null}
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {isMemberLoading ? (
              <p className="text-sm text-foreground-muted">현장 인력을 불러오는 중...</p>
            ) : filteredMembers.length === 0 ? (
              <p className="text-sm text-foreground-muted">선택 가능한 현장 인력이 없습니다.</p>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member._id}
                  type="button"
                  onClick={() => handleSelectOwner(member)}
                  className="w-full rounded-lg border border-border bg-background-soft px-3 py-2 text-left hover:bg-background-card"
                >
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {member.email || member.membershipRole || member.role}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
