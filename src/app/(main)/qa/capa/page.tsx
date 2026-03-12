"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QaFeedbackBanners } from "@/components/qa/feedback-banners";
import { QaFilterPanel } from "@/components/qa/filter-panel";
import { QaSortSelect } from "@/components/qa/sort-select";
import { DataTable, FormInput, Modal, Pagination } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import {
  findUniqueSiteMemberMatch,
  formatSiteMemberSummary,
  type SiteMemberOption,
  useSiteMembers,
} from "@/hooks/use-site-members";
import {
  QA_CAPA_ACTION_TYPE_LABELS,
  QA_CAPA_ACTION_TYPE_VALUES,
  QA_CAPA_ESCALATION_DAYS,
  QA_CAPA_PRIORITY_LABELS,
  QA_CAPA_PRIORITY_VALUES,
  QA_CAPA_SOURCE_TYPE_LABELS,
  QA_CAPA_SOURCE_TYPE_VALUES,
  QA_CAPA_STATUS_LABELS,
  QA_CAPA_STATUS_TRANSITIONS,
  QA_CAPA_STATUS_VALUES,
  QA_CAPA_WHY_ANALYSIS_STEPS,
  isQaCapaEscalated,
  isQaCapaOverdue,
  type QaCapaActionType,
  type QaCapaPriority,
  type QaCapaSourceType,
  type QaCapaStatus,
} from "@/lib/qa-capa";

type CapaItem = {
  _id: string;
  title: string;
  sourceType: QaCapaSourceType;
  sourceSummary: string;
  sourceAuditId: string;
  sourceAuditTitle: string;
  sourceChecklistId: string;
  sourceChecklistSection: string;
  sourceChecklistTitle: string;
  actionType: QaCapaActionType;
  priority: QaCapaPriority;
  status: QaCapaStatus;
  rootCauseSummary: string;
  whyAnalysis: string[];
  actionPlan: string;
  executionNote: string;
  assigneeName: string;
  assigneeMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  dueDate: string;
  verifiedAt?: string | null;
  verificationNote: string;
  createdAt: string;
  updatedAt: string;
  actions?: string;
};

type CapaSummary = {
  activeCount: number;
  verificationCount: number;
  overdueCount: number;
  escalatedCount: number;
};

type CapaResponse = {
  ok: boolean;
  data: CapaItem[];
  meta?: {
    page: number;
    totalPages: number;
    summary?: CapaSummary;
  };
  error?: string;
};

type AuditCandidateChecklist = {
  checklistId: string;
  sectionTitle: string;
  itemTitle: string;
  note: string;
  requiresCapa: boolean;
  linkedCapaId: string;
};

type AuditCandidateAudit = {
  _id: string;
  auditTitle: string;
  plannedDate: string;
  auditeeName: string;
  checklistItems: AuditCandidateChecklist[];
};

type AuditResponse = {
  ok: boolean;
  data?: AuditCandidateAudit[];
  error?: string;
};

type AuditCandidateOption = {
  key: string;
  auditId: string;
  auditTitle: string;
  plannedDate: string;
  auditeeName: string;
  checklistId: string;
  sectionTitle: string;
  itemTitle: string;
  note: string;
  linkedCapaId: string;
};

type CapaForm = {
  title: string;
  sourceType: QaCapaSourceType;
  sourceSummary: string;
  sourceAuditId: string;
  sourceAuditTitle: string;
  sourceChecklistId: string;
  sourceChecklistSection: string;
  sourceChecklistTitle: string;
  actionType: QaCapaActionType;
  priority: QaCapaPriority;
  status: QaCapaStatus;
  rootCauseSummary: string;
  whyAnalysis: string[];
  actionPlan: string;
  executionNote: string;
  assigneeName: string;
  assigneeMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  dueDate: string;
  verifiedAt: string;
  verificationNote: string;
};

type DeleteTarget = Pick<CapaItem, "_id" | "title" | "priority" | "dueDate">;
type CapaSort = "due_asc" | "due_desc" | "created_desc" | "status_asc";

const CAPA_SORT_OPTIONS: Array<{ value: CapaSort; label: string }> = [
  { value: "due_asc", label: "기한 빠른순" },
  { value: "due_desc", label: "기한 최신순" },
  { value: "created_desc", label: "최근 등록순" },
  { value: "status_asc", label: "상태순" },
];

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 10);
}

function truncateText(value: string, length = 90) {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length)}...`;
}

function createEmptyWhyAnalysis() {
  return QA_CAPA_WHY_ANALYSIS_STEPS.map(() => "");
}

function createEmptyForm(): CapaForm {
  const today = new Date();
  const dueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
    .toISOString()
    .slice(0, 10);

  return {
    title: "",
    sourceType: "manual",
    sourceSummary: "",
    sourceAuditId: "",
    sourceAuditTitle: "",
    sourceChecklistId: "",
    sourceChecklistSection: "",
    sourceChecklistTitle: "",
    actionType: "corrective",
    priority: "medium",
    status: "open",
    rootCauseSummary: "",
    whyAnalysis: createEmptyWhyAnalysis(),
    actionPlan: "",
    executionNote: "",
    assigneeName: "",
    assigneeMemberId: "",
    verifierName: "",
    verifierMemberId: "",
    dueDate,
    verifiedAt: "",
    verificationNote: "",
  };
}

function buildCandidateKey(auditId: string, checklistId: string) {
  return `${auditId}:${checklistId}`;
}

function buildCandidateLabel(item: AuditCandidateOption) {
  return `${formatDate(item.plannedDate)} · ${item.auditTitle} · ${item.sectionTitle} / ${item.itemTitle}`;
}

function StatusPill({ status }: { status: QaCapaStatus }) {
  const toneClass =
    status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "verification"
        ? "border-violet-200 bg-violet-50 text-violet-700"
        : status === "in_progress"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_CAPA_STATUS_LABELS[status]}
    </span>
  );
}

function PriorityPill({ priority }: { priority: QaCapaPriority }) {
  const toneClass =
    priority === "critical"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : priority === "high"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : priority === "medium"
          ? "border-slate-200 bg-slate-100 text-slate-700"
          : "border-slate-200 bg-white text-slate-600";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_CAPA_PRIORITY_LABELS[priority]}
    </span>
  );
}

function ActionTypePill({ actionType }: { actionType: QaCapaActionType }) {
  const toneClass =
    actionType === "corrective"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_CAPA_ACTION_TYPE_LABELS[actionType]}
    </span>
  );
}

export default function QaCapaPage() {
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

  const [items, setItems] = useState<CapaItem[]>([]);
  const [summary, setSummary] = useState<CapaSummary>({
    activeCount: 0,
    verificationCount: 0,
    overdueCount: 0,
    escalatedCount: 0,
  });
  const [auditOptions, setAuditOptions] = useState<AuditCandidateAudit[]>([]);
  const [isOptionLoading, setIsOptionLoading] = useState(false);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QaCapaStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | QaCapaPriority>("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<"all" | QaCapaSourceType>("all");
  const [actionTypeFilter, setActionTypeFilter] = useState<"all" | QaCapaActionType>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [escalationOnly, setEscalationOnly] = useState(false);
  const [sortBy, setSortBy] = useState<CapaSort>("due_asc");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusTransitionBase, setStatusTransitionBase] = useState<QaCapaStatus>("open");
  const [form, setForm] = useState<CapaForm>(() => createEmptyForm());
  const [memberPickerMode, setMemberPickerMode] = useState<"assignee" | "verifier" | null>(null);
  const [selectedItem, setSelectedItem] = useState<CapaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAuditOptions = useCallback(async () => {
    if (!canManage) {
      setAuditOptions([]);
      setOptionError(null);
      return;
    }

    setIsOptionLoading(true);
    setOptionError(null);
    try {
      const response = await fetch("/api/qa/audits?limit=100&capaOnly=true", { cache: "no-store" });
      const result = (await response.json()) as AuditResponse;
      if (!result.ok) {
        throw new Error(result.error ?? "CAPA 후보 심사 조회 실패");
      }

      setAuditOptions(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setAuditOptions([]);
      setOptionError(err instanceof Error ? err.message : "CAPA 후보 심사 조회 실패");
    } finally {
      setIsOptionLoading(false);
    }
  }, [canManage]);

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
          priority: priorityFilter,
          sourceType: sourceTypeFilter,
          actionType: actionTypeFilter,
          overdueOnly: overdueOnly ? "true" : "false",
          escalationOnly: escalationOnly ? "true" : "false",
          sort: sortBy,
        });

        const response = await fetch(`/api/qa/capa?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as CapaResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "CAPA 조회 실패");
        }

        setItems(Array.isArray(result.data) ? result.data : []);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
        setSummary(
          result.meta?.summary ?? {
            activeCount: 0,
            verificationCount: 0,
            overdueCount: 0,
            escalatedCount: 0,
          },
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "CAPA 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [actionTypeFilter, escalationOnly, keyword, overdueOnly, priorityFilter, sortBy, sourceTypeFilter, statusFilter],
  );

  useEffect(() => {
    void loadItems(1);
  }, [loadItems]);

  useEffect(() => {
    void loadAuditOptions();
  }, [loadAuditOptions]);

  function resetFilters() {
    setKeyword("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSourceTypeFilter("all");
    setActionTypeFilter("all");
    setOverdueOnly(false);
    setEscalationOnly(false);
    setSortBy("due_asc");
    void loadItems(1);
  }

  function resetForm() {
    setEditingId(null);
    setStatusTransitionBase("open");
    setForm(createEmptyForm());
    setMemberPickerMode(null);
  }

  function updateFormField<K extends keyof CapaForm>(field: K, value: CapaForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateWhyAnalysis(index: number, value: string) {
    setForm((current) => ({
      ...current,
      whyAnalysis: current.whyAnalysis.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  }

  function handleSourceTypeChange(nextSourceType: QaCapaSourceType) {
    setForm((current) => {
      if (nextSourceType === "audit") {
        return {
          ...current,
          sourceType: "audit",
          sourceSummary: "",
        };
      }

      return {
        ...current,
        sourceType: "manual",
        sourceAuditId: "",
        sourceAuditTitle: "",
        sourceChecklistId: "",
        sourceChecklistSection: "",
        sourceChecklistTitle: "",
      };
    });
  }

  const auditCandidateOptions = useMemo<AuditCandidateOption[]>(() => {
    return auditOptions.flatMap((audit) =>
      audit.checklistItems
        .filter(
          (item) => item.requiresCapa && (!item.linkedCapaId || (editingId !== null && item.linkedCapaId === editingId)),
        )
        .map((item) => ({
          key: buildCandidateKey(audit._id, item.checklistId),
          auditId: audit._id,
          auditTitle: audit.auditTitle,
          plannedDate: audit.plannedDate,
          auditeeName: audit.auditeeName,
          checklistId: item.checklistId,
          sectionTitle: item.sectionTitle,
          itemTitle: item.itemTitle,
          note: item.note,
          linkedCapaId: item.linkedCapaId,
        })),
    );
  }, [auditOptions, editingId]);

  const auditCandidateByKey = useMemo(
    () => new Map(auditCandidateOptions.map((item) => [item.key, item])),
    [auditCandidateOptions],
  );

  const selectedAuditCandidateKey = useMemo(() => {
    if (!form.sourceAuditId || !form.sourceChecklistId) {
      return "";
    }
    return buildCandidateKey(form.sourceAuditId, form.sourceChecklistId);
  }, [form.sourceAuditId, form.sourceChecklistId]);

  function handleAuditCandidateChange(value: string) {
    const candidate = auditCandidateByKey.get(value) ?? null;
    setForm((current) => ({
      ...current,
      sourceAuditId: candidate?.auditId ?? "",
      sourceAuditTitle: candidate?.auditTitle ?? "",
      sourceChecklistId: candidate?.checklistId ?? "",
      sourceChecklistSection: candidate?.sectionTitle ?? "",
      sourceChecklistTitle: candidate?.itemTitle ?? "",
      sourceSummary: candidate ? `${candidate.auditTitle} · ${candidate.sectionTitle} / ${candidate.itemTitle}` : "",
      title: current.title || !candidate ? current.title : `${candidate.auditTitle} - ${candidate.itemTitle}`,
      actionType: candidate ? "corrective" : current.actionType,
    }));
  }

  function handleOpenMemberPicker(mode: "assignee" | "verifier") {
    setMemberQuery("");
    setMemberPickerMode(mode);
  }

  function handleSelectMember(member: SiteMemberOption) {
    if (memberPickerMode === "assignee") {
      updateFormField("assigneeName", member.name);
      updateFormField("assigneeMemberId", member._id);
    }
    if (memberPickerMode === "verifier") {
      updateFormField("verifierName", member.name);
      updateFormField("verifierMemberId", member._id);
    }
    setMemberPickerMode(null);
  }

  function clearSelectedMember(mode: "assignee" | "verifier") {
    if (mode === "assignee") {
      updateFormField("assigneeName", "");
      updateFormField("assigneeMemberId", "");
      return;
    }
    updateFormField("verifierName", "");
    updateFormField("verifierMemberId", "");
  }

  const handleEdit = useCallback((item: CapaItem) => {
    setEditingId(item._id);
    setStatusTransitionBase(item.status);
    setForm({
      title: item.title,
      sourceType: item.sourceType,
      sourceSummary: item.sourceSummary,
      sourceAuditId: item.sourceAuditId,
      sourceAuditTitle: item.sourceAuditTitle,
      sourceChecklistId: item.sourceChecklistId,
      sourceChecklistSection: item.sourceChecklistSection,
      sourceChecklistTitle: item.sourceChecklistTitle,
      actionType: item.actionType,
      priority: item.priority,
      status: item.status,
      rootCauseSummary: item.rootCauseSummary,
      whyAnalysis: QA_CAPA_WHY_ANALYSIS_STEPS.map((_, index) => item.whyAnalysis[index] ?? ""),
      actionPlan: item.actionPlan,
      executionNote: item.executionNote,
      assigneeName: item.assigneeName,
      assigneeMemberId: item.assigneeMemberId,
      verifierName: item.verifierName,
      verifierMemberId: item.verifierMemberId,
      dueDate: formatDate(item.dueDate) === "-" ? "" : formatDate(item.dueDate),
      verifiedAt: formatDate(item.verifiedAt) === "-" ? "" : formatDate(item.verifiedAt),
      verificationNote: item.verificationNote,
    });
    setSelectedItem(null);
    setDeleteTarget(null);
    setMessage(null);
    setError(null);
  }, []);

  const handleRequestDelete = useCallback(
    (item: CapaItem) => {
      if (!canManage) {
        return;
      }
      setDeleteTarget({
        _id: item._id,
        title: item.title,
        priority: item.priority,
        dueDate: item.dueDate,
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
      const endpoint = editingId ? `/api/qa/capa/${editingId}` : "/api/qa/capa";
      const method = editingId ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          sourceType: form.sourceType,
          sourceSummary: form.sourceSummary,
          sourceAuditId: form.sourceAuditId,
          sourceChecklistId: form.sourceChecklistId,
          actionType: form.actionType,
          priority: form.priority,
          status: form.status,
          rootCauseSummary: form.rootCauseSummary,
          whyAnalysis: form.whyAnalysis,
          actionPlan: form.actionPlan,
          executionNote: form.executionNote,
          assigneeName: form.assigneeName,
          assigneeMemberId: form.assigneeMemberId,
          verifierName: form.verifierName,
          verifierMemberId: form.verifierMemberId,
          dueDate: form.dueDate,
          verifiedAt: form.verifiedAt,
          verificationNote: form.verificationNote,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "CAPA 저장 실패");
      }

      setMessage(editingId ? "CAPA가 수정되었습니다." : "CAPA가 등록되었습니다.");
      resetForm();
      await Promise.all([loadItems(1), loadAuditOptions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CAPA 저장 실패");
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
      const response = await fetch(`/api/qa/capa/${deleteTarget._id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "CAPA 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        resetForm();
      }
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }

      setDeleteTarget(null);
      setMessage("CAPA가 삭제되었습니다.");
      await Promise.all([loadItems(page), loadAuditOptions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CAPA 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const availableStatusOptions = useMemo(() => {
    if (!editingId) {
      return QA_CAPA_STATUS_VALUES.filter((item) => item === "open" || item === "in_progress");
    }

    const allowed = new Set<QaCapaStatus>([statusTransitionBase, ...QA_CAPA_STATUS_TRANSITIONS[statusTransitionBase]]);
    return QA_CAPA_STATUS_VALUES.filter((item) => allowed.has(item));
  }, [editingId, statusTransitionBase]);

  const transitionGuide = useMemo(() => {
    const allowed = editingId
      ? QA_CAPA_STATUS_TRANSITIONS[statusTransitionBase]
      : (["in_progress"] satisfies QaCapaStatus[]);

    return allowed.map((item) => QA_CAPA_STATUS_LABELS[item]).join(", ");
  }, [editingId, statusTransitionBase]);

  const selectedAssignee = useMemo(() => {
    return form.assigneeMemberId
      ? (memberOptionById.get(form.assigneeMemberId) ?? null)
      : findUniqueSiteMemberMatch(form.assigneeName, memberOptions);
  }, [form.assigneeMemberId, form.assigneeName, memberOptionById, memberOptions]);

  const selectedVerifier = useMemo(() => {
    return form.verifierMemberId
      ? (memberOptionById.get(form.verifierMemberId) ?? null)
      : findUniqueSiteMemberMatch(form.verifierName, memberOptions);
  }, [form.verifierMemberId, form.verifierName, memberOptionById, memberOptions]);

  const escalationItems = useMemo(() => {
    return items.filter((item) => isQaCapaEscalated(item.priority, item.status, item.dueDate)).slice(0, 4);
  }, [items]);

  const summaryCards = useMemo(
    () => [
      { label: "미완료 CAPA", value: summary.activeCount, tone: "text-foreground" },
      { label: "검증대기", value: summary.verificationCount, tone: "text-violet-700" },
      { label: "기한 경과", value: summary.overdueCount, tone: "text-rose-700" },
      { label: "에스컬레이션 대상", value: summary.escalatedCount, tone: "text-orange-700" },
    ],
    [summary],
  );

  const columns = useMemo<DataTableColumn<CapaItem>[]>(
    () => [
      {
        key: "dueDate",
        header: "기한",
        className: "w-32 align-top",
        render: (_value, row) => {
          const overdue = isQaCapaOverdue(row.dueDate, row.status);
          const escalated = isQaCapaEscalated(row.priority, row.status, row.dueDate);
          return (
            <div className="space-y-1 text-xs">
              <p className={`font-medium ${overdue ? "text-rose-700" : "text-foreground"}`}>
                기한 {formatDate(row.dueDate)}
              </p>
              <p className="text-foreground-muted">검증 {formatDate(row.verifiedAt)}</p>
              {escalated ? <p className="font-medium text-orange-700">에스컬레이션</p> : null}
            </div>
          );
        },
      },
      {
        key: "title",
        header: "CAPA",
        className: "min-w-[260px] align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.title}</p>
            <div className="flex flex-wrap gap-2">
              <ActionTypePill actionType={row.actionType} />
              <PriorityPill priority={row.priority} />
            </div>
            <p className="text-xs text-foreground-muted">{truncateText(row.rootCauseSummary)}</p>
          </div>
        ),
      },
      {
        key: "sourceSummary",
        header: "출처",
        className: "min-w-[220px] align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">{QA_CAPA_SOURCE_TYPE_LABELS[row.sourceType]}</p>
            <p className="text-xs text-foreground-muted">{row.sourceSummary || "출처 설명 없음"}</p>
            {row.sourceType === "audit" ? (
              <Link href="/qa/audits" className="text-xs font-medium text-sky-700 hover:underline">
                내부 심사 보기
              </Link>
            ) : null}
          </div>
        ),
      },
      {
        key: "assigneeName",
        header: "담당/검증",
        className: "min-w-[180px] align-top",
        render: (_value, row) => (
          <div className="space-y-1 text-xs">
            <p className="text-foreground">담당 {row.assigneeName}</p>
            <p className="text-foreground-muted">검증 {row.verifierName || "미지정"}</p>
            {row.status === "verification" ? (
              <p className="font-medium text-violet-700">검증 승인 대기</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "status",
        header: "상태",
        className: "w-28",
        render: (value) => <StatusPill status={value as QaCapaStatus} />,
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
        <h1 className="mt-2 text-2xl font-semibold text-foreground">개선조치 (CAPA)</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          내부 심사 부적합 항목 또는 수동 등록 출처에서 CAPA를 생성하고, 담당자·기한·검증 단계를 추적합니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/qa/audits"
            className="inline-flex rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-card"
          >
            내부 심사 보기
          </Link>
          <Link
            href="/qa/procedures"
            className="inline-flex rounded-md border border-border bg-background-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
          >
            절차서 보기
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]"
          >
            <p className="text-sm text-foreground-muted">{card.label}</p>
            <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{card.value}건</p>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">에스컬레이션 포인트</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              기한 경과 {QA_CAPA_ESCALATION_DAYS}일 이상 또는 우선순위 `높음/긴급` 건을 우선 추적합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOverdueOnly(false);
              setEscalationOnly(true);
            }}
            className="rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-card"
          >
            에스컬레이션만 보기
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {escalationItems.length ? (
            escalationItems.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="rounded-lg border border-border bg-background-soft px-4 py-3 text-left hover:bg-background-card"
              >
                <p className="text-xs font-medium text-orange-700">{formatDate(item.dueDate)}</p>
                <p className="mt-1 font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-foreground-muted">{item.assigneeName}</p>
              </button>
            ))
          ) : (
            <p className="text-sm text-foreground-muted">현재 페이지 기준 에스컬레이션 대상이 없습니다.</p>
          )}
        </div>
      </section>

      <QaFilterPanel
        description="우선순위와 상태 기준으로 지연 CAPA를 빠르게 추적합니다."
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
          <div className="flex flex-wrap items-center gap-4">
            <QaSortSelect
              compact
              value={sortBy}
              options={CAPA_SORT_OPTIONS}
              onChange={(value) => setSortBy(value as CapaSort)}
            />
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(event) => setOverdueOnly(event.target.checked)}
                className="h-4 w-4 rounded border border-border"
              />
              <span>기한 경과 항목만 보기</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={escalationOnly}
                onChange={(event) => setEscalationOnly(event.target.checked)}
                className="h-4 w-4 rounded border border-border"
              />
              <span>에스컬레이션 대상만 보기</span>
            </label>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_150px_150px_150px_150px]">
          <FormInput
            label="검색어"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="제목, 출처, 담당자, 원인, 조치계획"
          />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">상태</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | QaCapaStatus)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_CAPA_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {QA_CAPA_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">우선순위</span>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as "all" | QaCapaPriority)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_CAPA_PRIORITY_VALUES.map((priority) => (
                <option key={priority} value={priority}>
                  {QA_CAPA_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">출처</span>
            <select
              value={sourceTypeFilter}
              onChange={(event) => setSourceTypeFilter(event.target.value as "all" | QaCapaSourceType)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_CAPA_SOURCE_TYPE_VALUES.map((sourceType) => (
                <option key={sourceType} value={sourceType}>
                  {QA_CAPA_SOURCE_TYPE_LABELS[sourceType]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">조치 유형</span>
            <select
              value={actionTypeFilter}
              onChange={(event) => setActionTypeFilter(event.target.value as "all" | QaCapaActionType)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_CAPA_ACTION_TYPE_VALUES.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {QA_CAPA_ACTION_TYPE_LABELS[actionType]}
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
              <h2 className="text-lg font-semibold text-foreground">{editingId ? "CAPA 수정" : "CAPA 등록"}</h2>
              <p className="mt-1 text-sm text-foreground-muted">
                등록 {editingId ? `후 이동 가능 상태: ${transitionGuide || "없음"}` : "후 조치중 상태로 전환 가능합니다."}
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
              label="CAPA 제목"
              value={form.title}
              onChange={(event) => updateFormField("title", event.target.value)}
              placeholder="예: 타설 품질 부적합 시정조치"
              required
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">출처 유형</span>
              <select
                value={form.sourceType}
                onChange={(event) => handleSourceTypeChange(event.target.value as QaCapaSourceType)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_CAPA_SOURCE_TYPE_VALUES.map((sourceType) => (
                  <option key={sourceType} value={sourceType}>
                    {QA_CAPA_SOURCE_TYPE_LABELS[sourceType]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">조치 유형</span>
              <select
                value={form.actionType}
                onChange={(event) => updateFormField("actionType", event.target.value as QaCapaActionType)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_CAPA_ACTION_TYPE_VALUES.map((actionType) => (
                  <option key={actionType} value={actionType}>
                    {QA_CAPA_ACTION_TYPE_LABELS[actionType]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">상태</span>
              <select
                value={form.status}
                onChange={(event) => updateFormField("status", event.target.value as QaCapaStatus)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {availableStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {QA_CAPA_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {form.sourceType === "manual" ? (
            <FormInput
              label="수동 등록 출처"
              value={form.sourceSummary}
              onChange={(event) => updateFormField("sourceSummary", event.target.value)}
              placeholder="예: 고객 클레임, 현장 순회 점검"
              required
            />
          ) : (
            <div className="space-y-2">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">CAPA 후보 심사 항목</span>
                <select
                  value={selectedAuditCandidateKey}
                  onChange={(event) => handleAuditCandidateChange(event.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  <option value="">심사 항목 선택</option>
                  {auditCandidateOptions.map((candidate) => (
                    <option key={candidate.key} value={candidate.key}>
                      {buildCandidateLabel(candidate)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-border bg-background-soft p-4 text-sm">
                <p className="font-medium text-foreground">{form.sourceSummary || "선택된 심사 항목이 없습니다."}</p>
                {form.sourceSummary ? (
                  <p className="mt-1 text-foreground-muted">
                    {form.sourceAuditTitle} / {form.sourceChecklistSection} / {form.sourceChecklistTitle}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-foreground-muted">
                  {isOptionLoading
                    ? "심사 CAPA 후보를 불러오는 중입니다."
                    : "부적합 + CAPA 후보 표시된 심사 항목만 선택할 수 있습니다."}
                </p>
              </div>
              {optionError ? <p className="text-sm text-danger">{optionError}</p> : null}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">우선순위</span>
              <select
                value={form.priority}
                onChange={(event) => updateFormField("priority", event.target.value as QaCapaPriority)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_CAPA_PRIORITY_VALUES.map((priority) => (
                  <option key={priority} value={priority}>
                    {QA_CAPA_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </label>
            <FormInput
              label="조치 기한"
              type="date"
              value={form.dueDate}
              onChange={(event) => updateFormField("dueDate", event.target.value)}
              required
            />
            <div className="space-y-1">
              <span className="block text-sm font-medium text-foreground">조치 담당자</span>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  readOnly
                  value={formatSiteMemberSummary(selectedAssignee, form.assigneeName)}
                  placeholder="현장 인력에서 선택"
                  className="h-9 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => handleOpenMemberPicker("assignee")}
                  className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                >
                  사용자 선택
                </button>
                <button
                  type="button"
                  onClick={() => clearSelectedMember("assignee")}
                  className="rounded-md border border-border bg-background-card px-3 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                >
                  초기화
                </button>
              </div>
            </div>
          </div>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">발생 원인</span>
            <textarea
              value={form.rootCauseSummary}
              onChange={(event) => updateFormField("rootCauseSummary", event.target.value)}
              rows={3}
              required
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="부적합 또는 예방 필요 원인을 요약하세요."
            />
          </label>

          <div className="space-y-2 rounded-xl border border-border bg-background-soft p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">5 Why 원인 분석</h3>
              <p className="mt-1 text-xs text-foreground-muted">필요한 단계만 입력해도 됩니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
              {QA_CAPA_WHY_ANALYSIS_STEPS.map((step, index) => (
                <FormInput
                  key={step}
                  label={`Why ${step}`}
                  value={form.whyAnalysis[index] ?? ""}
                  onChange={(event) => updateWhyAnalysis(index, event.target.value)}
                  placeholder={`원인 단계 ${step}`}
                />
              ))}
            </div>
          </div>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">조치 계획</span>
            <textarea
              value={form.actionPlan}
              onChange={(event) => updateFormField("actionPlan", event.target.value)}
              rows={3}
              required
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="실행 항목, 일정, 완료 기준을 입력하세요."
            />
          </label>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">실행 내역</span>
            <textarea
              value={form.executionNote}
              onChange={(event) => updateFormField("executionNote", event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="조치 결과, 사진 근거, 현장 반영 내용을 입력하세요."
            />
          </label>

          <div className="space-y-3 rounded-xl border border-border bg-background-soft p-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">검증 정보</h3>
              <p className="mt-1 text-xs text-foreground-muted">
                `완료` 상태로 저장하려면 검증자, 검증일, 검증 메모가 필요합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <span className="block text-sm font-medium text-foreground">검증자</span>
                <div className="flex flex-col gap-2 md:flex-row">
                  <input
                    readOnly
                    value={formatSiteMemberSummary(selectedVerifier, form.verifierName)}
                    placeholder="현장 인력에서 선택"
                    className="h-9 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenMemberPicker("verifier")}
                    className="rounded-md border border-border bg-background-card px-3 py-2 text-sm font-medium text-foreground hover:bg-background-soft"
                  >
                    사용자 선택
                  </button>
                  <button
                    type="button"
                    onClick={() => clearSelectedMember("verifier")}
                    className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                  >
                    초기화
                  </button>
                </div>
              </div>
              <FormInput
                label="검증일"
                type="date"
                value={form.verifiedAt}
                onChange={(event) => updateFormField("verifiedAt", event.target.value)}
              />
            </div>

            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">검증 메모</span>
              <textarea
                value={form.verificationNote}
                onChange={(event) => updateFormField("verificationNote", event.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                placeholder="조치 유효성, 재발 방지 여부, 추가 보완 사항"
              />
            </label>
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

      <DataTable<CapaItem>
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "CAPA를 불러오는 중입니다." : "등록된 CAPA가 없습니다."}
        onRowClick={(row) => setSelectedItem(row)}
        getRowAriaLabel={(row) => `${row.title} 상세 보기`}
      />

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadItems(nextPage)} />
      ) : null}

      <Modal
        open={memberPickerMode !== null}
        title={memberPickerMode === "verifier" ? "검증자 선택" : "조치 담당자 선택"}
        onClose={() => setMemberPickerMode(null)}
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
                  onClick={() => handleSelectMember(member)}
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

      <Modal open={selectedItem !== null} title="CAPA 상세" onClose={() => setSelectedItem(null)}>
        {selectedItem ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background-soft p-3 text-sm">
              <div>
                <p className="text-xs font-medium text-foreground-muted">출처 유형</p>
                <p className="mt-1 text-foreground">{QA_CAPA_SOURCE_TYPE_LABELS[selectedItem.sourceType]}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">조치 유형</p>
                <div className="mt-1">
                  <ActionTypePill actionType={selectedItem.actionType} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">우선순위</p>
                <div className="mt-1">
                  <PriorityPill priority={selectedItem.priority} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">상태</p>
                <div className="mt-1">
                  <StatusPill status={selectedItem.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">조치 기한</p>
                <p className="mt-1 text-foreground">{formatDate(selectedItem.dueDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">검증일</p>
                <p className="mt-1 text-foreground">{formatDate(selectedItem.verifiedAt)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">CAPA 제목</p>
              <p className="mt-1 font-medium text-foreground">{selectedItem.title}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">출처</p>
              <p className="mt-1 text-sm text-foreground">{selectedItem.sourceSummary || "출처 설명 없음"}</p>
              {selectedItem.sourceType === "audit" ? (
                <p className="mt-1 text-xs text-foreground-muted">
                  {selectedItem.sourceAuditTitle} / {selectedItem.sourceChecklistSection} /{" "}
                  {selectedItem.sourceChecklistTitle}
                </p>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">발생 원인</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.rootCauseSummary}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground-muted">5 Why</p>
              {selectedItem.whyAnalysis.some((item) => item.trim()) ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {selectedItem.whyAnalysis.map((item, index) =>
                    item.trim() ? (
                      <div key={`${selectedItem._id}-why-${index}`} className="rounded-lg border border-border bg-background-soft p-3">
                        <p className="text-xs font-medium text-foreground-muted">Why {index + 1}</p>
                        <p className="mt-1 text-sm text-foreground">{item}</p>
                      </div>
                    ) : null,
                  )}
                </div>
              ) : (
                <p className="text-sm text-foreground-muted">입력된 5 Why 분석이 없습니다.</p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">조치 계획</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{selectedItem.actionPlan}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">실행 내역</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.executionNote || "실행 내역 없음"}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-foreground-muted">조치 담당자</p>
                <p className="mt-1 text-sm text-foreground">{selectedItem.assigneeName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">검증자</p>
                <p className="mt-1 text-sm text-foreground">{selectedItem.verifierName || "미지정"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">검증 메모</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.verificationNote || "검증 메모 없음"}
              </p>
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
        title="CAPA 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">아래 CAPA를 삭제하시겠습니까?</p>
            <div className="rounded-lg border border-border bg-background-soft p-3 text-sm text-foreground">
              <p className="font-medium">{deleteTarget.title}</p>
              <p className="mt-1 text-foreground-muted">
                {QA_CAPA_PRIORITY_LABELS[deleteTarget.priority]} · 기한 {formatDate(deleteTarget.dueDate)}
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
    </section>
  );
}
