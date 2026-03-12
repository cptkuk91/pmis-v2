"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QaFeedbackBanners } from "@/components/qa/feedback-banners";
import { QaFilterPanel } from "@/components/qa/filter-panel";
import { QaSortSelect } from "@/components/qa/sort-select";
import { DataTable, FormInput, Modal, Pagination } from "@/components/ui";
import type { DataTableColumn } from "@/components/ui/data-table";
import {
  formatSiteMemberSummary,
  type SiteMemberOption,
  useSiteMembers,
} from "@/hooks/use-site-members";
import { hasMinRole, useCurrentUser } from "@/hooks/use-current-user";
import {
  QA_AUDIT_RESULT_LABELS,
  QA_AUDIT_RESULT_VALUES,
  QA_AUDIT_STATUS_LABELS,
  QA_AUDIT_STATUS_VALUES,
  QA_AUDIT_TYPE_LABELS,
  QA_AUDIT_TYPE_VALUES,
  type QaAuditResult,
  type QaAuditStatus,
  type QaAuditType,
} from "@/lib/qa-audits";

type AssurancePlanOption = {
  _id: string;
  year: number;
  versionNo: number;
  planTitle: string;
  status: string;
};

type ProcedureOption = {
  _id: string;
  documentKey: string;
  title: string;
  versionNo: number;
  status: string;
  documentType: string;
};

type AuditProcedureRef = {
  procedureId: string;
  documentKey: string;
  title: string;
  versionNo: number;
};

type AuditChecklistItem = {
  checklistId: string;
  sectionTitle: string;
  itemTitle: string;
  criteria: string;
  result: QaAuditResult;
  note: string;
  requiresCapa: boolean;
  linkedCapaId: string;
};

type AuditItem = {
  _id: string;
  auditTitle: string;
  auditType: QaAuditType;
  status: QaAuditStatus;
  plannedDate: string;
  actualDate?: string | null;
  auditeeName: string;
  scopeSummary: string;
  auditLeadName: string;
  auditLeadMemberId: string;
  linkedAssurancePlanId: string;
  linkedAssurancePlanTitle: string;
  linkedAssurancePlanYear?: number | null;
  linkedAssurancePlanVersionNo?: number | null;
  referencedProcedures: AuditProcedureRef[];
  checklistItems: AuditChecklistItem[];
  resultSummary: string;
  nonconformityCount: number;
  observationCount: number;
  capaRequestedCount: number;
  createdAt: string;
  updatedAt: string;
  actions?: string;
};

type AuditResponse = {
  ok: boolean;
  data: AuditItem[];
  meta?: { page: number; totalPages: number };
  error?: string;
};

type AuditForm = {
  auditTitle: string;
  auditType: QaAuditType;
  status: QaAuditStatus;
  plannedDate: string;
  actualDate: string;
  auditeeName: string;
  scopeSummary: string;
  auditLeadName: string;
  auditLeadMemberId: string;
  linkedAssurancePlanId: string;
  linkedAssurancePlanTitle: string;
  linkedAssurancePlanYear: string;
  linkedAssurancePlanVersionNo: string;
  referencedProcedures: AuditProcedureRef[];
  checklistItems: AuditChecklistItem[];
  resultSummary: string;
};

type DeleteTarget = Pick<AuditItem, "_id" | "auditTitle" | "plannedDate">;
type AuditSort = "planned_asc" | "planned_desc" | "nonconformity_desc" | "status_asc";

const AUDIT_SORT_OPTIONS: Array<{ value: AuditSort; label: string }> = [
  { value: "planned_asc", label: "예정일 빠른순" },
  { value: "planned_desc", label: "예정일 최신순" },
  { value: "nonconformity_desc", label: "부적합 많은순" },
  { value: "status_asc", label: "상태순" },
];

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 10);
}

function createChecklistDraft(): AuditChecklistItem {
  const checklistId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `audit-item-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    checklistId,
    sectionTitle: "",
    itemTitle: "",
    criteria: "",
    result: "conformity",
    note: "",
    requiresCapa: false,
    linkedCapaId: "",
  };
}

function createEmptyForm(): AuditForm {
  const today = new Date().toISOString().slice(0, 10);
  return {
    auditTitle: "",
    auditType: "regular",
    status: "planned",
    plannedDate: today,
    actualDate: "",
    auditeeName: "",
    scopeSummary: "",
    auditLeadName: "",
    auditLeadMemberId: "",
    linkedAssurancePlanId: "",
    linkedAssurancePlanTitle: "",
    linkedAssurancePlanYear: "",
    linkedAssurancePlanVersionNo: "",
    referencedProcedures: [],
    checklistItems: [createChecklistDraft()],
    resultSummary: "",
  };
}

function buildAssurancePlanLabel(item: AssurancePlanOption) {
  return `${item.year}년 Ver.${item.versionNo} · ${item.planTitle}`;
}

function buildProcedureLabel(item: ProcedureOption) {
  return `${item.documentKey} Ver.${item.versionNo} · ${item.title}`;
}

function countUpcomingAudits(items: AuditItem[]) {
  const today = new Date().toISOString().slice(0, 10);
  return items.filter((item) => formatDate(item.plannedDate) >= today && item.status !== "closed").length;
}

function countCompletedAudits(items: AuditItem[]) {
  return items.filter((item) => item.status === "completed" || item.status === "closed").length;
}

function StatusPill({ status }: { status: QaAuditStatus }) {
  const toneClass =
    status === "closed"
      ? "border-slate-200 bg-slate-100 text-slate-600"
      : status === "completed"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : status === "in_progress"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_AUDIT_STATUS_LABELS[status]}
    </span>
  );
}

function ResultPill({ result }: { result: QaAuditResult }) {
  const toneClass =
    result === "nonconformity"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : result === "observation"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>
      {QA_AUDIT_RESULT_LABELS[result]}
    </span>
  );
}

export default function QaAuditsPage() {
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

  const [assurancePlanOptions, setAssurancePlanOptions] = useState<AssurancePlanOption[]>([]);
  const [procedureOptions, setProcedureOptions] = useState<ProcedureOption[]>([]);
  const [optionError, setOptionError] = useState<string | null>(null);

  const [items, setItems] = useState<AuditItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [auditTypeFilter, setAuditTypeFilter] = useState<"all" | QaAuditType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | QaAuditStatus>("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [capaOnly, setCapaOnly] = useState(false);
  const [sortBy, setSortBy] = useState<AuditSort>("planned_asc");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AuditForm>(() => createEmptyForm());
  const [selectedItem, setSelectedItem] = useState<AuditItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leadPickerOpen, setLeadPickerOpen] = useState(false);

  const loadOptions = useCallback(async () => {
    if (!canManage) {
      setAssurancePlanOptions([]);
      setProcedureOptions([]);
      return;
    }

    try {
      setOptionError(null);
      const [assuranceResponse, procedureResponse] = await Promise.all([
        fetch("/api/qa/assurance-plans?limit=100", { cache: "no-store" }),
        fetch("/api/qa/procedures?limit=100&versionView=latest&status=active", { cache: "no-store" }),
      ]);

      const assuranceResult = (await assuranceResponse.json()) as {
        ok: boolean;
        data?: AssurancePlanOption[];
        error?: string;
      };
      const procedureResult = (await procedureResponse.json()) as {
        ok: boolean;
        data?: ProcedureOption[];
        error?: string;
      };

      if (!assuranceResult.ok) {
        throw new Error(assuranceResult.error ?? "QAP 옵션 조회 실패");
      }
      if (!procedureResult.ok) {
        throw new Error(procedureResult.error ?? "절차서 옵션 조회 실패");
      }

      setAssurancePlanOptions(Array.isArray(assuranceResult.data) ? assuranceResult.data : []);
      setProcedureOptions(Array.isArray(procedureResult.data) ? procedureResult.data : []);
    } catch (err) {
      setAssurancePlanOptions([]);
      setProcedureOptions([]);
      setOptionError(err instanceof Error ? err.message : "옵션 조회 실패");
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
          auditType: auditTypeFilter,
          status: statusFilter,
          capaOnly: capaOnly ? "true" : "false",
          sort: sortBy,
        });
        if (monthFilter) {
          params.set("month", monthFilter);
        }

        const response = await fetch(`/api/qa/audits?${params.toString()}`, { cache: "no-store" });
        const result = (await response.json()) as AuditResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "내부 심사 조회 실패");
        }

        setItems(Array.isArray(result.data) ? result.data : []);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "내부 심사 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [auditTypeFilter, capaOnly, keyword, monthFilter, sortBy, statusFilter],
  );

  useEffect(() => {
    void loadItems(1);
  }, [loadItems]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  function resetFilters() {
    setKeyword("");
    setAuditTypeFilter("all");
    setStatusFilter("all");
    setMonthFilter("");
    setCapaOnly(false);
    setSortBy("planned_asc");
    void loadItems(1);
  }

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setLeadPickerOpen(false);
  }

  function updateFormField<K extends keyof AuditForm>(field: K, value: AuditForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateChecklistField<K extends keyof AuditChecklistItem>(
    checklistId: string,
    field: K,
    value: AuditChecklistItem[K],
  ) {
    setForm((current) => ({
      ...current,
      checklistItems: current.checklistItems.map((item) => {
        if (item.checklistId !== checklistId) {
          return item;
        }
        const nextItem = { ...item, [field]: value };
        if (field === "result" && value !== "nonconformity") {
          nextItem.requiresCapa = false;
          nextItem.linkedCapaId = "";
        }
        return nextItem;
      }),
    }));
  }

  function handleAddChecklistItem() {
    setForm((current) => ({
      ...current,
      checklistItems: [...current.checklistItems, createChecklistDraft()],
    }));
  }

  function handleRemoveChecklistItem(checklistId: string) {
    setForm((current) => {
      if (current.checklistItems.length === 1) {
        return current;
      }
      return {
        ...current,
        checklistItems: current.checklistItems.filter((item) => item.checklistId !== checklistId),
      };
    });
  }

  function handleSelectLead(member: SiteMemberOption) {
    updateFormField("auditLeadName", member.name);
    updateFormField("auditLeadMemberId", member._id);
    setLeadPickerOpen(false);
  }

  function handleAssurancePlanChange(planId: string) {
    const selected = assurancePlanOptions.find((item) => item._id === planId);
    setForm((current) => ({
      ...current,
      linkedAssurancePlanId: selected?._id ?? "",
      linkedAssurancePlanTitle: selected?.planTitle ?? "",
      linkedAssurancePlanYear: selected ? String(selected.year) : "",
      linkedAssurancePlanVersionNo: selected ? String(selected.versionNo) : "",
    }));
  }

  function handleToggleProcedure(item: ProcedureOption) {
    setForm((current) => {
      const exists = current.referencedProcedures.some((procedure) => procedure.procedureId === item._id);
      return {
        ...current,
        referencedProcedures: exists
          ? current.referencedProcedures.filter((procedure) => procedure.procedureId !== item._id)
          : [
              ...current.referencedProcedures,
              {
                procedureId: item._id,
                documentKey: item.documentKey,
                title: item.title,
                versionNo: item.versionNo,
              },
            ],
      };
    });
  }

  const handleEdit = useCallback((item: AuditItem) => {
    setEditingId(item._id);
    setForm({
      auditTitle: item.auditTitle,
      auditType: item.auditType,
      status: item.status,
      plannedDate: formatDate(item.plannedDate) === "-" ? "" : formatDate(item.plannedDate),
      actualDate: formatDate(item.actualDate) === "-" ? "" : formatDate(item.actualDate),
      auditeeName: item.auditeeName,
      scopeSummary: item.scopeSummary,
      auditLeadName: item.auditLeadName,
      auditLeadMemberId: item.auditLeadMemberId,
      linkedAssurancePlanId: item.linkedAssurancePlanId,
      linkedAssurancePlanTitle: item.linkedAssurancePlanTitle,
      linkedAssurancePlanYear: item.linkedAssurancePlanYear ? String(item.linkedAssurancePlanYear) : "",
      linkedAssurancePlanVersionNo: item.linkedAssurancePlanVersionNo
        ? String(item.linkedAssurancePlanVersionNo)
        : "",
      referencedProcedures: item.referencedProcedures.map((procedure) => ({
        procedureId: procedure.procedureId,
        documentKey: procedure.documentKey,
        title: procedure.title,
        versionNo: procedure.versionNo,
      })),
      checklistItems: item.checklistItems.length
        ? item.checklistItems.map((checklist) => ({
            checklistId: checklist.checklistId,
            sectionTitle: checklist.sectionTitle,
            itemTitle: checklist.itemTitle,
            criteria: checklist.criteria,
            result: checklist.result,
            note: checklist.note,
            requiresCapa: checklist.requiresCapa,
            linkedCapaId: checklist.linkedCapaId,
          }))
        : [createChecklistDraft()],
      resultSummary: item.resultSummary,
    });
    setSelectedItem(null);
    setMessage(null);
    setError(null);
  }, []);

  const handleRequestDelete = useCallback(
    (item: AuditItem) => {
      if (!canManage) {
        return;
      }
      setDeleteTarget({
        _id: item._id,
        auditTitle: item.auditTitle,
        plannedDate: item.plannedDate,
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
      const endpoint = editingId ? `/api/qa/audits/${editingId}` : "/api/qa/audits";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditTitle: form.auditTitle,
          auditType: form.auditType,
          status: form.status,
          plannedDate: form.plannedDate,
          actualDate: form.actualDate,
          auditeeName: form.auditeeName,
          scopeSummary: form.scopeSummary,
          auditLeadName: form.auditLeadName,
          auditLeadMemberId: form.auditLeadMemberId,
          linkedAssurancePlanId: form.linkedAssurancePlanId,
          linkedAssurancePlanTitle: form.linkedAssurancePlanTitle,
          linkedAssurancePlanYear: form.linkedAssurancePlanYear,
          linkedAssurancePlanVersionNo: form.linkedAssurancePlanVersionNo,
          referencedProcedures: form.referencedProcedures,
          checklistItems: form.checklistItems,
          resultSummary: form.resultSummary,
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "내부 심사 저장 실패");
      }

      setMessage(editingId ? "내부 심사가 수정되었습니다." : "내부 심사가 등록되었습니다.");
      resetForm();
      await loadItems(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "내부 심사 저장 실패");
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
      const response = await fetch(`/api/qa/audits/${deleteTarget._id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "내부 심사 삭제 실패");
      }
      if (editingId === deleteTarget._id) {
        resetForm();
      }
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }
      setDeleteTarget(null);
      setMessage("내부 심사가 삭제되었습니다.");
      await loadItems(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "내부 심사 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const upcomingAudits = useMemo(() => {
    return [...items]
      .filter((item) => item.status === "planned" || item.status === "in_progress")
      .sort((left, right) => formatDate(left.plannedDate).localeCompare(formatDate(right.plannedDate)))
      .slice(0, 4);
  }, [items]);

  const summaryCards = useMemo(() => {
    return [
      { label: "예정 심사", value: countUpcomingAudits(items) },
      { label: "완료/종결", value: countCompletedAudits(items) },
      {
        label: "부적합 항목",
        value: items.reduce((sum, item) => sum + item.nonconformityCount, 0),
      },
      {
        label: "CAPA 후보",
        value: items.reduce((sum, item) => sum + item.capaRequestedCount, 0),
      },
    ];
  }, [items]);

  const columns = useMemo<DataTableColumn<AuditItem>[]>(
    () => [
      {
        key: "plannedDate",
        header: "일정",
        className: "w-32 align-top",
        render: (_value, row) => (
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">예정 {formatDate(row.plannedDate)}</p>
            <p className="text-foreground-muted">실시 {formatDate(row.actualDate)}</p>
          </div>
        ),
      },
      {
        key: "auditTitle",
        header: "내부 심사",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.auditTitle}</p>
            <p className="text-xs text-foreground-muted">
              {QA_AUDIT_TYPE_LABELS[row.auditType]} · {row.auditeeName}
            </p>
            <p className="text-xs text-foreground-muted">책임자 {row.auditLeadName}</p>
          </div>
        ),
      },
      {
        key: "checklistItems",
        header: "결과 요약",
        className: "min-w-[240px] align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              부적합 {row.nonconformityCount}건 · 관찰 {row.observationCount}건
            </p>
            <p className="text-xs text-foreground-muted">{row.resultSummary || "결과 요약 없음"}</p>
            {row.capaRequestedCount > 0 ? (
              <p className="text-xs font-medium text-rose-700">CAPA 후보 {row.capaRequestedCount}건</p>
            ) : null}
          </div>
        ),
      },
      {
        key: "status",
        header: "상태",
        className: "w-24",
        render: (value) => <StatusPill status={value as QaAuditStatus} />,
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

  const selectedLead = form.auditLeadMemberId ? memberOptionById.get(form.auditLeadMemberId) ?? null : null;
  const selectedProcedureIds = useMemo(
    () => new Set(form.referencedProcedures.map((item) => item.procedureId)),
    [form.referencedProcedures],
  );

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-border bg-background-card p-6 shadow-[var(--shadow-soft)]">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground-muted">QA</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">내부 심사</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          정기/수시 심사 계획과 결과를 기록하고, 부적합 항목을 CAPA 후보로 넘길 수 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/qa/assurance-plan"
            className="inline-flex rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-card"
          >
            QAP 보기
          </Link>
          <Link
            href="/qa/procedures"
            className="inline-flex rounded-md border border-border bg-background-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
          >
            절차서 보기
          </Link>
          <Link
            href="/qa/capa"
            className="inline-flex rounded-md border border-border bg-background-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
          >
            CAPA 보기
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
            <p className="mt-2 text-2xl font-bold text-foreground">{card.value}건</p>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">예정 심사 일정</h2>
          <span className="text-xs text-foreground-muted">계획 또는 진행중인 심사</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {upcomingAudits.length ? (
            upcomingAudits.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="rounded-lg border border-border bg-background-soft px-4 py-3 text-left hover:bg-background-card"
              >
                <p className="text-xs font-medium text-foreground-muted">{formatDate(item.plannedDate)}</p>
                <p className="mt-1 font-medium text-foreground">{item.auditTitle}</p>
                <p className="mt-1 text-xs text-foreground-muted">{item.auditeeName}</p>
              </button>
            ))
          ) : (
            <p className="text-sm text-foreground-muted">예정된 심사가 없습니다.</p>
          )}
        </div>
      </section>

      <QaFilterPanel
        description="심사 유형, 상태, 월 기준으로 계획과 결과를 빠르게 점검합니다."
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
            <QaSortSelect
              compact
              value={sortBy}
              options={AUDIT_SORT_OPTIONS}
              onChange={(value) => setSortBy(value as AuditSort)}
            />
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={capaOnly}
                onChange={(event) => setCapaOnly(event.target.checked)}
                className="h-4 w-4 rounded border border-border"
              />
              <span>CAPA 후보 항목이 있는 심사만 보기</span>
            </label>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_160px_160px_160px]">
          <FormInput
            label="검색어"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="심사명, 대상, 책임자, 점검 항목"
          />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">심사 유형</span>
            <select
              value={auditTypeFilter}
              onChange={(event) => setAuditTypeFilter(event.target.value as "all" | QaAuditType)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_AUDIT_TYPE_VALUES.map((type) => (
                <option key={type} value={type}>
                  {QA_AUDIT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">상태</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | QaAuditStatus)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_AUDIT_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {QA_AUDIT_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">심사 월</span>
            <input
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            />
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
                {editingId ? "내부 심사 수정" : "내부 심사 등록"}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                심사 계획과 결과를 한 폼에서 관리합니다.
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
              label="심사명"
              value={form.auditTitle}
              onChange={(event) => updateFormField("auditTitle", event.target.value)}
              required
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">심사 유형</span>
              <select
                value={form.auditType}
                onChange={(event) => updateFormField("auditType", event.target.value as QaAuditType)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_AUDIT_TYPE_VALUES.map((type) => (
                  <option key={type} value={type}>
                    {QA_AUDIT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">상태</span>
              <select
                value={form.status}
                onChange={(event) => updateFormField("status", event.target.value as QaAuditStatus)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_AUDIT_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {QA_AUDIT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <FormInput
              label="심사 대상"
              value={form.auditeeName}
              onChange={(event) => updateFormField("auditeeName", event.target.value)}
              placeholder="예: 콘크리트 타설 공정"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <FormInput
              label="예정일"
              type="date"
              value={form.plannedDate}
              onChange={(event) => updateFormField("plannedDate", event.target.value)}
              required
            />
            <FormInput
              label="실시일"
              type="date"
              value={form.actualDate}
              onChange={(event) => updateFormField("actualDate", event.target.value)}
            />
            <div className="space-y-1">
              <span className="block text-sm font-medium text-foreground">심사 책임자</span>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  readOnly
                  value={formatSiteMemberSummary(selectedLead, form.auditLeadName)}
                  placeholder="현장 인력에서 선택"
                  className="h-9 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMemberQuery("");
                    setLeadPickerOpen(true);
                  }}
                  className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                >
                  사용자 선택
                </button>
              </div>
            </div>
          </div>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">심사 범위</span>
            <textarea
              value={form.scopeSummary}
              onChange={(event) => updateFormField("scopeSummary", event.target.value)}
              rows={3}
              required
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="심사 범위와 확인 항목 범주를 설명하세요."
            />
          </label>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">연결 QAP</span>
              <select
                value={form.linkedAssurancePlanId}
                onChange={(event) => handleAssurancePlanChange(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="">선택 안함</option>
                {assurancePlanOptions.map((option) => (
                  <option key={option._id} value={option._id}>
                    {buildAssurancePlanLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2 rounded-lg border border-border bg-background-soft p-4">
              <p className="text-sm font-medium text-foreground">참조 절차서/템플릿</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {procedureOptions.map((option) => (
                  <label key={option._id} className="inline-flex items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={selectedProcedureIds.has(option._id)}
                      onChange={() => handleToggleProcedure(option)}
                      className="mt-0.5 h-4 w-4 rounded border border-border"
                    />
                    <span>{buildProcedureLabel(option)}</span>
                  </label>
                ))}
                {!procedureOptions.length ? (
                  <p className="text-sm text-foreground-muted">참조 가능한 절차서가 없습니다.</p>
                ) : null}
              </div>
            </div>
          </div>

          {optionError ? <p className="text-sm text-danger">{optionError}</p> : null}

          <div className="space-y-3 rounded-xl border border-border bg-background-soft p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">점검 항목</h3>
                <p className="mt-1 text-xs text-foreground-muted">
                  결과가 `부적합`인 항목만 CAPA 후보로 넘길 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddChecklistItem}
                className="rounded-md border border-border bg-background-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
              >
                점검 항목 추가
              </button>
            </div>

            <div className="space-y-3">
              {form.checklistItems.map((item, index) => (
                <div key={item.checklistId} className="rounded-lg border border-border bg-background-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">점검 항목 {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveChecklistItem(item.checklistId)}
                      disabled={form.checklistItems.length === 1}
                      className="rounded-md border border-border px-3 py-1 text-xs text-foreground-muted hover:bg-background-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <FormInput
                      label="점검 구분"
                      value={item.sectionTitle}
                      onChange={(event) => updateChecklistField(item.checklistId, "sectionTitle", event.target.value)}
                      placeholder="예: 서류, 시공, 자재"
                      required
                    />
                    <FormInput
                      label="점검 항목명"
                      value={item.itemTitle}
                      onChange={(event) => updateChecklistField(item.checklistId, "itemTitle", event.target.value)}
                      required
                    />
                    <label className="space-y-1 lg:col-span-2">
                      <span className="block text-sm font-medium text-foreground">기준</span>
                      <textarea
                        value={item.criteria}
                        onChange={(event) => updateChecklistField(item.checklistId, "criteria", event.target.value)}
                        rows={2}
                        required
                        className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                        placeholder="점검 기준 또는 확인 방법"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">결과</span>
                      <select
                        value={item.result}
                        onChange={(event) =>
                          updateChecklistField(item.checklistId, "result", event.target.value as QaAuditResult)
                        }
                        className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                      >
                        {QA_AUDIT_RESULT_VALUES.map((result) => (
                          <option key={result} value={result}>
                            {QA_AUDIT_RESULT_LABELS[result]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">CAPA 연계</p>
                      <label className="inline-flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={item.requiresCapa}
                          disabled={item.result !== "nonconformity"}
                          onChange={(event) =>
                            updateChecklistField(item.checklistId, "requiresCapa", event.target.checked)
                          }
                          className="h-4 w-4 rounded border border-border"
                        />
                        <span>부적합 항목을 CAPA 후보로 표시</span>
                      </label>
                      {item.requiresCapa ? (
                        <div className="rounded-md border border-border bg-background-card px-3 py-2 text-xs text-foreground-muted">
                          <p>
                            {item.linkedCapaId
                              ? `연결 CAPA ${item.linkedCapaId}`
                              : "CAPA 화면에서 등록하면 자동으로 연결됩니다."}
                          </p>
                          <Link href="/qa/capa" className="mt-2 inline-flex font-medium text-sky-700 hover:underline">
                            CAPA 화면 열기
                          </Link>
                        </div>
                      ) : null}
                    </div>
                    <label className="space-y-1 lg:col-span-2">
                      <span className="block text-sm font-medium text-foreground">메모</span>
                      <textarea
                        value={item.note}
                        onChange={(event) => updateChecklistField(item.checklistId, "note", event.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                        placeholder="근거, 보완 필요사항, 사진 설명"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">결과 요약</span>
            <textarea
              value={form.resultSummary}
              onChange={(event) => updateFormField("resultSummary", event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="심사 총평과 후속 조치 방향을 입력하세요."
            />
          </label>

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

      <DataTable<AuditItem>
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={isLoading ? "내부 심사를 불러오는 중입니다." : "등록된 내부 심사가 없습니다."}
        onRowClick={(row) => setSelectedItem(row)}
        getRowAriaLabel={(row) => `${row.auditTitle} 상세 보기`}
      />

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadItems(nextPage)} />
      ) : null}

      <Modal open={leadPickerOpen} title="심사 책임자 선택" onClose={() => setLeadPickerOpen(false)}>
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
                  onClick={() => handleSelectLead(member)}
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

      <Modal open={selectedItem !== null} title="내부 심사 상세" onClose={() => setSelectedItem(null)}>
        {selectedItem ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background-soft p-3 text-sm">
              <div>
                <p className="text-xs font-medium text-foreground-muted">심사 유형</p>
                <p className="mt-1 text-foreground">{QA_AUDIT_TYPE_LABELS[selectedItem.auditType]}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">상태</p>
                <div className="mt-1">
                  <StatusPill status={selectedItem.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">예정일</p>
                <p className="mt-1 text-foreground">{formatDate(selectedItem.plannedDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">실시일</p>
                <p className="mt-1 text-foreground">{formatDate(selectedItem.actualDate)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">심사명</p>
              <p className="mt-1 font-medium text-foreground">{selectedItem.auditTitle}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-foreground-muted">심사 대상</p>
                <p className="mt-1 text-sm text-foreground">{selectedItem.auditeeName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">심사 책임자</p>
                <p className="mt-1 text-sm text-foreground">{selectedItem.auditLeadName}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">심사 범위</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.scopeSummary}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">연결 QAP</p>
              <p className="mt-1 text-sm text-foreground">
                {selectedItem.linkedAssurancePlanTitle
                  ? `${selectedItem.linkedAssurancePlanTitle} (${selectedItem.linkedAssurancePlanYear ?? "-"}년 Ver.${selectedItem.linkedAssurancePlanVersionNo ?? "-"})`
                  : "연결 안함"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">참조 절차서</p>
              {selectedItem.referencedProcedures.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedItem.referencedProcedures.map((procedure) => (
                    <span
                      key={`${procedure.procedureId}-${procedure.versionNo}`}
                      className="rounded-full border border-border bg-background-soft px-3 py-1 text-xs text-foreground"
                    >
                      {procedure.documentKey} Ver.{procedure.versionNo}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-sm text-foreground">참조 절차서 없음</p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">결과 요약</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.resultSummary || "결과 요약 없음"}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground-muted">부적합/관찰 항목</p>
              {selectedItem.checklistItems.filter((item) => item.result !== "conformity").length ? (
                selectedItem.checklistItems
                  .filter((item) => item.result !== "conformity")
                  .map((item) => (
                    <div key={item.checklistId} className="rounded-lg border border-border bg-background-soft p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">
                          {item.sectionTitle} · {item.itemTitle}
                        </p>
                        <ResultPill result={item.result} />
                      </div>
                      <p className="mt-1 text-sm text-foreground">{item.criteria}</p>
                      {item.note ? (
                        <p className="mt-1 text-xs leading-5 text-foreground-muted">{item.note}</p>
                      ) : null}
                      {item.requiresCapa ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium text-rose-700">
                            {item.linkedCapaId
                              ? `CAPA 연결됨 · ${item.linkedCapaId}`
                              : "CAPA 후보 전달됨"}
                          </p>
                          <Link href="/qa/capa" className="inline-flex text-xs font-medium text-sky-700 hover:underline">
                            CAPA 화면에서 후속 조치 보기
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ))
              ) : (
                <p className="text-sm text-foreground-muted">부적합 또는 관찰 항목이 없습니다.</p>
              )}
            </div>

            <details className="rounded-lg border border-border bg-background-soft p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">전체 점검 항목 보기</summary>
              <div className="mt-3 space-y-2">
                {selectedItem.checklistItems.map((item) => (
                  <div key={item.checklistId} className="rounded-md border border-border bg-background-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {item.sectionTitle} · {item.itemTitle}
                      </p>
                      <ResultPill result={item.result} />
                    </div>
                    <p className="mt-1 text-sm text-foreground">{item.criteria}</p>
                  </div>
                ))}
              </div>
            </details>

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
        title="내부 심사 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">아래 내부 심사를 삭제하시겠습니까?</p>
            <div className="rounded-lg border border-border bg-background-soft p-3 text-sm text-foreground">
              <p className="font-medium">{deleteTarget.auditTitle}</p>
              <p className="mt-1 text-foreground-muted">예정일 {formatDate(deleteTarget.plannedDate)}</p>
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
