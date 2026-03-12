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
  QA_CAPA_PRIORITY_LABELS,
  QA_CAPA_STATUS_LABELS,
  type QaCapaPriority,
  type QaCapaStatus,
} from "@/lib/qa-capa";
import {
  QA_PARTNER_ASSURANCE_STATUS_LABELS,
  QA_PARTNER_ASSURANCE_STATUS_VALUES,
  QA_PARTNER_CATEGORY_LABELS,
  QA_PARTNER_CATEGORY_VALUES,
  QA_PARTNER_CRITERION_CATEGORY_LABELS,
  QA_PARTNER_CRITERION_CATEGORY_VALUES,
  QA_PARTNER_DEFAULT_CRITERIA,
  QA_PARTNER_EVALUATION_TYPE_LABELS,
  QA_PARTNER_EVALUATION_TYPE_VALUES,
  QA_PARTNER_FOLLOW_UP_STATUS_LABELS,
  QA_PARTNER_FOLLOW_UP_STATUS_VALUES,
  QA_PARTNER_GRADE_LABELS,
  QA_PARTNER_GRADE_VALUES,
  QA_PARTNER_RISK_LEVEL_LABELS,
  QA_PARTNER_SOURCE_LABELS,
  getQaPartnerGrade,
  getQaPartnerRiskLevel,
  needsQaPartnerFollowUp,
  type QaPartnerAssuranceStatus,
  type QaPartnerCategory,
  type QaPartnerCriterionCategory,
  type QaPartnerEvaluationType,
  type QaPartnerFollowUpStatus,
  type QaPartnerGrade,
  type QaPartnerRiskLevel,
} from "@/lib/qa-partner-assurance";

type PartnerAssessmentItem = {
  itemId: string;
  criterionCategory: QaPartnerCriterionCategory;
  criterionTitle: string;
  maxScore: string;
  score: string;
  comment: string;
  requiresImprovement: boolean;
};

type PartnerAssuranceItem = {
  _id: string;
  partnerCode: string;
  partnerName: string;
  partnerSource: "system_code" | "approved_supplier" | "manual";
  partnerCategory: QaPartnerCategory;
  evaluationType: QaPartnerEvaluationType;
  status: QaPartnerAssuranceStatus;
  evaluationDate: string;
  nextReviewDate?: string | null;
  evaluatorName: string;
  evaluatorMemberId: string;
  contactName: string;
  contactPhone: string;
  scopeSummary: string;
  summary: string;
  improvementRequest: string;
  followUpStatus: QaPartnerFollowUpStatus;
  linkedCapaId: string;
  assessmentItems: Array<{
    itemId: string;
    criterionCategory: QaPartnerCriterionCategory;
    criterionTitle: string;
    maxScore: number;
    score: number;
    comment: string;
    requiresImprovement: boolean;
  }>;
  totalScore: number;
  maxScore: number;
  grade: QaPartnerGrade;
  riskLevel: QaPartnerRiskLevel;
  createdAt: string;
  updatedAt: string;
  actions?: string;
};

type PartnerAssuranceSummary = {
  evaluationCount: number;
  distinctPartnerCount: number;
  followUpPendingCount: number;
  highRiskCount: number;
  linkedCapaCount: number;
};

type PartnerAssuranceResponse = {
  ok: boolean;
  data: PartnerAssuranceItem[];
  meta?: {
    page: number;
    totalPages: number;
    summary?: PartnerAssuranceSummary;
  };
  error?: string;
};

type PartnerOption = {
  key: string;
  partnerCode: string;
  partnerName: string;
  partnerSource: "system_code" | "approved_supplier";
  partnerCategory: "subcontractor" | "material_supplier" | "equipment_supplier";
};

type CapaOption = {
  _id: string;
  title: string;
  status: QaCapaStatus;
  priority: QaCapaPriority;
  dueDate?: string | null;
};

type PartnerAssuranceOptionsResponse = {
  ok: boolean;
  data?: {
    partnerOptions: PartnerOption[];
    capaOptions: CapaOption[];
  };
  error?: string;
};

type PartnerAssuranceForm = {
  partnerCode: string;
  partnerName: string;
  partnerSource: "system_code" | "approved_supplier" | "manual";
  partnerCategory: QaPartnerCategory;
  evaluationType: QaPartnerEvaluationType;
  status: QaPartnerAssuranceStatus;
  evaluationDate: string;
  nextReviewDate: string;
  evaluatorName: string;
  evaluatorMemberId: string;
  contactName: string;
  contactPhone: string;
  scopeSummary: string;
  summary: string;
  improvementRequest: string;
  followUpStatus: QaPartnerFollowUpStatus;
  linkedCapaId: string;
  assessmentItems: PartnerAssessmentItem[];
};

type DeleteTarget = Pick<PartnerAssuranceItem, "_id" | "partnerName" | "evaluationDate" | "grade">;
type AssessmentTemplate = (typeof QA_PARTNER_DEFAULT_CRITERIA)[number];
type PartnerAssuranceSort = "evaluation_desc" | "evaluation_asc" | "score_desc" | "partner_name";

const PARTNER_ASSURANCE_SORT_OPTIONS: Array<{ value: PartnerAssuranceSort; label: string }> = [
  { value: "evaluation_desc", label: "평가일 최신순" },
  { value: "evaluation_asc", label: "평가일 오래된순" },
  { value: "score_desc", label: "총점 높은순" },
  { value: "partner_name", label: "협력사명순" },
];

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return String(value).slice(0, 10);
}

function createAssessmentItem(
  template: AssessmentTemplate = QA_PARTNER_DEFAULT_CRITERIA[0],
  score = 0,
  requiresImprovement = false,
  comment = "",
): PartnerAssessmentItem {
  const itemId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `partner-assessment-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    itemId,
    criterionCategory: template.criterionCategory,
    criterionTitle: template.criterionTitle,
    maxScore: String(template.maxScore),
    score: String(score),
    comment,
    requiresImprovement,
  };
}

function createDefaultAssessmentItems() {
  return QA_PARTNER_DEFAULT_CRITERIA.map((template) => createAssessmentItem(template));
}

function createEmptyForm(): PartnerAssuranceForm {
  const today = new Date();
  const nextReviewDate = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate())
    .toISOString()
    .slice(0, 10);

  return {
    partnerCode: "",
    partnerName: "",
    partnerSource: "manual",
    partnerCategory: "subcontractor",
    evaluationType: "regular",
    status: "draft",
    evaluationDate: today.toISOString().slice(0, 10),
    nextReviewDate,
    evaluatorName: "",
    evaluatorMemberId: "",
    contactName: "",
    contactPhone: "",
    scopeSummary: "",
    summary: "",
    improvementRequest: "",
    followUpStatus: "not_required",
    linkedCapaId: "",
    assessmentItems: createDefaultAssessmentItems(),
  };
}

function buildCapaLabel(item: CapaOption) {
  return `${item.title} · ${QA_CAPA_STATUS_LABELS[item.status]} · ${QA_CAPA_PRIORITY_LABELS[item.priority]}`;
}

function StatusPill({ status }: { status: QaPartnerAssuranceStatus }) {
  const toneClass =
    status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "follow_up"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : status === "in_review"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_PARTNER_ASSURANCE_STATUS_LABELS[status]}
    </span>
  );
}

function GradePill({ grade }: { grade: QaPartnerGrade }) {
  const toneClass =
    grade === "A"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : grade === "B"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : grade === "C"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_PARTNER_GRADE_LABELS[grade]}
    </span>
  );
}

function RiskPill({ riskLevel }: { riskLevel: QaPartnerRiskLevel }) {
  const toneClass =
    riskLevel === "high"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : riskLevel === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_PARTNER_RISK_LEVEL_LABELS[riskLevel]}
    </span>
  );
}

function FollowUpPill({ status }: { status: QaPartnerFollowUpStatus }) {
  const toneClass =
    status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "requested"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass}`}>
      {QA_PARTNER_FOLLOW_UP_STATUS_LABELS[status]}
    </span>
  );
}

export default function QaPartnerAssurancePage() {
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

  const [items, setItems] = useState<PartnerAssuranceItem[]>([]);
  const [summary, setSummary] = useState<PartnerAssuranceSummary>({
    evaluationCount: 0,
    distinctPartnerCount: 0,
    followUpPendingCount: 0,
    highRiskCount: 0,
    linkedCapaCount: 0,
  });
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [capaOptions, setCapaOptions] = useState<CapaOption[]>([]);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [isOptionLoading, setIsOptionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [evaluationTypeFilter, setEvaluationTypeFilter] = useState<"all" | QaPartnerEvaluationType>("all");
  const [partnerCategoryFilter, setPartnerCategoryFilter] = useState<"all" | QaPartnerCategory>("all");
  const [gradeFilter, setGradeFilter] = useState<"all" | QaPartnerGrade>("all");
  const [riskLevelFilter, setRiskLevelFilter] = useState<"all" | QaPartnerRiskLevel>("all");
  const [followUpFilter, setFollowUpFilter] = useState<"all" | QaPartnerFollowUpStatus>("all");
  const [sortBy, setSortBy] = useState<PartnerAssuranceSort>("evaluation_desc");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PartnerAssuranceForm>(() => createEmptyForm());
  const [evaluatorPickerOpen, setEvaluatorPickerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PartnerAssuranceItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const partnerOptionByKey = useMemo(() => new Map(partnerOptions.map((item) => [item.key, item])), [partnerOptions]);

  const selectedPartnerOptionKey = useMemo(() => {
    const matched = partnerOptions.find((item) => {
      return (
        item.partnerName === form.partnerName &&
        item.partnerCategory === form.partnerCategory &&
        item.partnerSource === form.partnerSource &&
        item.partnerCode === form.partnerCode
      );
    });
    return matched?.key ?? "";
  }, [form.partnerCategory, form.partnerCode, form.partnerName, form.partnerSource, partnerOptions]);

  const selectedEvaluator = useMemo(() => {
    return form.evaluatorMemberId
      ? (memberOptionById.get(form.evaluatorMemberId) ?? null)
      : findUniqueSiteMemberMatch(form.evaluatorName, memberOptions);
  }, [form.evaluatorMemberId, form.evaluatorName, memberOptionById, memberOptions]);

  const assessmentScoreSummary = useMemo(() => {
    const totals = form.assessmentItems.reduce(
      (acc, item) => {
        const maxScore = Number(item.maxScore || 0);
        const score = Number(item.score || 0);
        if (Number.isFinite(maxScore)) {
          acc.maxScore += Math.max(0, maxScore);
        }
        if (Number.isFinite(score)) {
          acc.totalScore += Math.max(0, score);
        }
        if (item.requiresImprovement) {
          acc.improvementCount += 1;
        }
        return acc;
      },
      { totalScore: 0, maxScore: 0, improvementCount: 0 },
    );

    const grade = getQaPartnerGrade(totals.totalScore, totals.maxScore);
    const requiresFollowUp = needsQaPartnerFollowUp(grade, totals.improvementCount);
    const riskLevel = getQaPartnerRiskLevel(grade, totals.improvementCount, form.followUpStatus);

    return {
      ...totals,
      grade,
      riskLevel,
      requiresFollowUp,
    };
  }, [form.assessmentItems, form.followUpStatus]);

  const loadOptions = useCallback(async () => {
    if (!canManage) {
      setPartnerOptions([]);
      setCapaOptions([]);
      setOptionError(null);
      return;
    }

    setIsOptionLoading(true);
    setOptionError(null);
    try {
      const response = await fetch("/api/qa/partner-assurance/options", { cache: "no-store" });
      const result = (await response.json()) as PartnerAssuranceOptionsResponse;
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? "협력사 옵션 조회 실패");
      }

      setPartnerOptions(Array.isArray(result.data.partnerOptions) ? result.data.partnerOptions : []);
      setCapaOptions(Array.isArray(result.data.capaOptions) ? result.data.capaOptions : []);
    } catch (err) {
      setPartnerOptions([]);
      setCapaOptions([]);
      setOptionError(err instanceof Error ? err.message : "협력사 옵션 조회 실패");
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
          evaluationType: evaluationTypeFilter,
          partnerCategory: partnerCategoryFilter,
          grade: gradeFilter,
          riskLevel: riskLevelFilter,
          followUpStatus: followUpFilter,
          sort: sortBy,
        });

        if (partnerFilter) {
          params.set("partnerName", partnerFilter);
        }

        const response = await fetch(`/api/qa/partner-assurance?${params.toString()}`, {
          cache: "no-store",
        });
        const result = (await response.json()) as PartnerAssuranceResponse;
        if (!result.ok) {
          throw new Error(result.error ?? "협력사 품질보증 평가 조회 실패");
        }

        setItems(Array.isArray(result.data) ? result.data : []);
        setPage(result.meta?.page ?? 1);
        setTotalPages(result.meta?.totalPages ?? 1);
        setSummary(
          result.meta?.summary ?? {
            evaluationCount: 0,
            distinctPartnerCount: 0,
            followUpPendingCount: 0,
            highRiskCount: 0,
            linkedCapaCount: 0,
          },
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "협력사 품질보증 평가 조회 실패");
      } finally {
        setIsLoading(false);
      }
    },
    [evaluationTypeFilter, followUpFilter, gradeFilter, keyword, partnerCategoryFilter, partnerFilter, riskLevelFilter, sortBy],
  );

  useEffect(() => {
    void loadItems(1);
  }, [loadItems]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  function resetFilters() {
    setKeyword("");
    setPartnerFilter("");
    setEvaluationTypeFilter("all");
    setPartnerCategoryFilter("all");
    setGradeFilter("all");
    setFollowUpFilter("all");
    setRiskLevelFilter("all");
    setSortBy("evaluation_desc");
    void loadItems(1);
  }

  useEffect(() => {
    if (editingId || form.evaluatorMemberId || !user.userName || !memberOptions.length) {
      return;
    }

    const matched = findUniqueSiteMemberMatch(user.userName, memberOptions);
    if (!matched) {
      return;
    }

    setForm((current) => {
      if (current.evaluatorMemberId) {
        return current;
      }
      return {
        ...current,
        evaluatorName: matched.name,
        evaluatorMemberId: matched._id,
      };
    });
  }, [editingId, form.evaluatorMemberId, memberOptions, user.userName]);

  function resetForm() {
    setEditingId(null);
    setForm(createEmptyForm());
    setEvaluatorPickerOpen(false);
  }

  function updateFormField<K extends keyof PartnerAssuranceForm>(field: K, value: PartnerAssuranceForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAssessmentItemField<K extends keyof PartnerAssessmentItem>(
    itemId: string,
    field: K,
    value: PartnerAssessmentItem[K],
  ) {
    setForm((current) => ({
      ...current,
      assessmentItems: current.assessmentItems.map((item) =>
        item.itemId === itemId ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function handleLoadDefaultCriteria() {
    setForm((current) => ({
      ...current,
      assessmentItems: createDefaultAssessmentItems(),
    }));
  }

  function handleAddAssessmentItem() {
    setForm((current) => ({
      ...current,
      assessmentItems: [...current.assessmentItems, createAssessmentItem()],
    }));
  }

  function handleRemoveAssessmentItem(itemId: string) {
    setForm((current) => {
      if (current.assessmentItems.length === 1) {
        return current;
      }
      return {
        ...current,
        assessmentItems: current.assessmentItems.filter((item) => item.itemId !== itemId),
      };
    });
  }

  function handlePartnerOptionChange(value: string) {
    const selected = partnerOptionByKey.get(value) ?? null;
    setForm((current) => ({
      ...current,
      partnerCode: selected?.partnerCode ?? current.partnerCode,
      partnerName: selected?.partnerName ?? current.partnerName,
      partnerSource: selected?.partnerSource ?? current.partnerSource,
      partnerCategory: selected?.partnerCategory ?? current.partnerCategory,
    }));
  }

  function handlePartnerNameChange(value: string) {
    setForm((current) => ({
      ...current,
      partnerName: value,
      partnerSource:
        selectedPartnerOptionKey && value !== current.partnerName ? "manual" : current.partnerSource,
      partnerCode: selectedPartnerOptionKey && value !== current.partnerName ? "" : current.partnerCode,
    }));
  }

  function handleFollowUpStatusChange(nextStatus: QaPartnerFollowUpStatus) {
    let nextEvaluationStatus: QaPartnerAssuranceStatus | null = null;
    if (nextStatus === "requested") {
      nextEvaluationStatus = "follow_up";
    }

    setForm((current) => ({
      ...current,
      followUpStatus: nextStatus,
      linkedCapaId: nextStatus === "not_required" ? "" : current.linkedCapaId,
      improvementRequest: nextStatus === "not_required" ? "" : current.improvementRequest,
      status:
        nextEvaluationStatus ??
        (current.status === "follow_up" && nextStatus !== "requested" ? "completed" : current.status),
    }));
  }

  function handleSelectEvaluator(member: SiteMemberOption) {
    updateFormField("evaluatorName", member.name);
    updateFormField("evaluatorMemberId", member._id);
    setEvaluatorPickerOpen(false);
  }

  const handleEdit = useCallback((item: PartnerAssuranceItem) => {
    setEditingId(item._id);
    setForm({
      partnerCode: item.partnerCode,
      partnerName: item.partnerName,
      partnerSource: item.partnerSource,
      partnerCategory: item.partnerCategory,
      evaluationType: item.evaluationType,
      status: item.status,
      evaluationDate: formatDate(item.evaluationDate) === "-" ? "" : formatDate(item.evaluationDate),
      nextReviewDate: formatDate(item.nextReviewDate) === "-" ? "" : formatDate(item.nextReviewDate),
      evaluatorName: item.evaluatorName,
      evaluatorMemberId: item.evaluatorMemberId,
      contactName: item.contactName,
      contactPhone: item.contactPhone,
      scopeSummary: item.scopeSummary,
      summary: item.summary,
      improvementRequest: item.improvementRequest,
      followUpStatus: item.followUpStatus,
      linkedCapaId: item.linkedCapaId,
      assessmentItems: item.assessmentItems.length
        ? item.assessmentItems.map((assessment) => ({
            itemId: assessment.itemId,
            criterionCategory: assessment.criterionCategory,
            criterionTitle: assessment.criterionTitle,
            maxScore: String(assessment.maxScore),
            score: String(assessment.score),
            comment: assessment.comment,
            requiresImprovement: assessment.requiresImprovement,
          }))
        : createDefaultAssessmentItems(),
    });
    setSelectedItem(null);
    setDeleteTarget(null);
    setMessage(null);
    setError(null);
  }, []);

  const handleRequestDelete = useCallback(
    (item: PartnerAssuranceItem) => {
      if (!canManage) {
        return;
      }
      setDeleteTarget({
        _id: item._id,
        partnerName: item.partnerName,
        evaluationDate: item.evaluationDate,
        grade: item.grade,
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
      const endpoint = editingId ? `/api/qa/partner-assurance/${editingId}` : "/api/qa/partner-assurance";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerCode: form.partnerCode,
          partnerName: form.partnerName,
          partnerSource: form.partnerSource,
          partnerCategory: form.partnerCategory,
          evaluationType: form.evaluationType,
          status: form.status,
          evaluationDate: form.evaluationDate,
          nextReviewDate: form.nextReviewDate,
          evaluatorName: form.evaluatorName,
          evaluatorMemberId: form.evaluatorMemberId,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          scopeSummary: form.scopeSummary,
          summary: form.summary,
          improvementRequest: form.improvementRequest,
          followUpStatus: form.followUpStatus,
          linkedCapaId: form.linkedCapaId,
          assessmentItems: form.assessmentItems.map((item) => ({
            itemId: item.itemId,
            criterionCategory: item.criterionCategory,
            criterionTitle: item.criterionTitle,
            maxScore: Number(item.maxScore || 0),
            score: Number(item.score || 0),
            comment: item.comment,
            requiresImprovement: item.requiresImprovement,
          })),
        }),
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "협력사 품질보증 평가 저장 실패");
      }

      setMessage(editingId ? "협력사 품질보증 평가가 수정되었습니다." : "협력사 품질보증 평가가 등록되었습니다.");
      resetForm();
      await Promise.all([loadItems(1), loadOptions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "협력사 품질보증 평가 저장 실패");
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
      const response = await fetch(`/api/qa/partner-assurance/${deleteTarget._id}`, { method: "DELETE" });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!result.ok) {
        throw new Error(result.error ?? "협력사 품질보증 평가 삭제 실패");
      }

      if (editingId === deleteTarget._id) {
        resetForm();
      }
      if (selectedItem?._id === deleteTarget._id) {
        setSelectedItem(null);
      }

      setDeleteTarget(null);
      setMessage("협력사 품질보증 평가가 삭제되었습니다.");
      await loadItems(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "협력사 품질보증 평가 삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const alertItems = useMemo(() => {
    return items
      .filter((item) => item.riskLevel === "high" || item.followUpStatus === "requested")
      .slice(0, 4);
  }, [items]);

  const summaryCards = useMemo(
    () => [
      { label: "평가 이력", value: `${summary.evaluationCount}건` },
      { label: "관리 협력사", value: `${summary.distinctPartnerCount}개사` },
      { label: "후속조치 대기", value: `${summary.followUpPendingCount}건` },
      { label: "고위험/저평가", value: `${summary.highRiskCount}건` },
      { label: "CAPA 연계", value: `${summary.linkedCapaCount}건` },
    ],
    [summary],
  );

  const columns = useMemo<DataTableColumn<PartnerAssuranceItem>[]>(
    () => [
      {
        key: "evaluationDate",
        header: "평가일",
        className: "w-32 align-top",
        render: (_value, row) => (
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">{formatDate(row.evaluationDate)}</p>
            <p className="text-foreground-muted">차기 {formatDate(row.nextReviewDate)}</p>
          </div>
        ),
      },
      {
        key: "partnerName",
        header: "협력사",
        className: "min-w-[220px] align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="font-medium text-foreground">{row.partnerName}</p>
            <p className="text-xs text-foreground-muted">
              {QA_PARTNER_CATEGORY_LABELS[row.partnerCategory]} · {QA_PARTNER_EVALUATION_TYPE_LABELS[row.evaluationType]}
            </p>
            <p className="text-xs text-foreground-muted">
              {QA_PARTNER_SOURCE_LABELS[row.partnerSource]}
              {row.partnerCode ? ` · ${row.partnerCode}` : ""}
            </p>
          </div>
        ),
      },
      {
        key: "totalScore",
        header: "점수/등급",
        className: "w-36 align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {row.totalScore} / {row.maxScore}
            </p>
            <div className="flex flex-wrap gap-2">
              <GradePill grade={row.grade} />
              <RiskPill riskLevel={row.riskLevel} />
            </div>
          </div>
        ),
      },
      {
        key: "followUpStatus",
        header: "후속조치",
        className: "min-w-[220px] align-top",
        render: (_value, row) => (
          <div className="space-y-1">
            <FollowUpPill status={row.followUpStatus} />
            <p className="text-xs text-foreground-muted">{row.improvementRequest || "개선 요청 없음"}</p>
            {row.linkedCapaId ? (
              <Link href="/qa/capa" className="inline-flex text-xs font-medium text-sky-700 hover:underline">
                CAPA 연결됨 · {row.linkedCapaId}
              </Link>
            ) : null}
          </div>
        ),
      },
      {
        key: "status",
        header: "상태",
        className: "w-28",
        render: (value) => <StatusPill status={value as QaPartnerAssuranceStatus} />,
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
        <h1 className="mt-2 text-2xl font-semibold text-foreground">협력사 품질보증</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          협력사 평가 이력, 개선 요청, 고위험 신호, CAPA 연계 포인트를 함께 관리합니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/qa/capa"
            className="inline-flex rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-card"
          >
            CAPA 보기
          </Link>
          <Link
            href="/resource-procurement/supplier-approvals"
            className="inline-flex rounded-md border border-border bg-background-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
          >
            업체 승인 보기
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-xl border border-border bg-background-card p-4 shadow-[var(--shadow-soft)]"
          >
            <p className="text-sm text-foreground-muted">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{card.value}</p>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-background-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">리스크 신호</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              고위험 또는 후속조치 요청 상태인 협력사를 우선 관리합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRiskLevelFilter("high")}
            className="rounded-md border border-border bg-background-soft px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-card"
          >
            고위험만 보기
          </button>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {alertItems.length ? (
            alertItems.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => setSelectedItem(item)}
                className="rounded-lg border border-border bg-background-soft px-4 py-3 text-left hover:bg-background-card"
              >
                <p className="text-xs font-medium text-foreground-muted">{formatDate(item.evaluationDate)}</p>
                <p className="mt-1 font-medium text-foreground">{item.partnerName}</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {QA_PARTNER_GRADE_LABELS[item.grade]} · {QA_PARTNER_RISK_LEVEL_LABELS[item.riskLevel]}
                </p>
              </button>
            ))
          ) : (
            <p className="text-sm text-foreground-muted">현재 페이지 기준 위험 신호가 없습니다.</p>
          )}
        </div>
      </section>

      <QaFilterPanel
        description="협력사, 평가유형, 등급 기준으로 품질 평가 이력을 빠르게 정리합니다."
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
              options={PARTNER_ASSURANCE_SORT_OPTIONS}
              onChange={(value) => setSortBy(value as PartnerAssuranceSort)}
            />
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={riskLevelFilter === "high"}
                onChange={(event) => setRiskLevelFilter(event.target.checked ? "high" : "all")}
                className="h-4 w-4 rounded border border-border"
              />
              <span>고위험 협력사만 보기</span>
            </label>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_200px_140px_140px_140px_140px]">
          <FormInput
            label="검색어"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="협력사, 범위, 요약, 평가자, 평가 항목"
          />
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">협력사 이력</span>
            <select
              value={partnerFilter}
              onChange={(event) => setPartnerFilter(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="">전체</option>
              {partnerOptions.map((option) => (
                <option key={option.key} value={option.partnerName}>
                  {option.partnerName}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">평가 유형</span>
            <select
              value={evaluationTypeFilter}
              onChange={(event) => setEvaluationTypeFilter(event.target.value as "all" | QaPartnerEvaluationType)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_PARTNER_EVALUATION_TYPE_VALUES.map((type) => (
                <option key={type} value={type}>
                  {QA_PARTNER_EVALUATION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">협력사 구분</span>
            <select
              value={partnerCategoryFilter}
              onChange={(event) => setPartnerCategoryFilter(event.target.value as "all" | QaPartnerCategory)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_PARTNER_CATEGORY_VALUES.map((category) => (
                <option key={category} value={category}>
                  {QA_PARTNER_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">등급</span>
            <select
              value={gradeFilter}
              onChange={(event) => setGradeFilter(event.target.value as "all" | QaPartnerGrade)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_PARTNER_GRADE_VALUES.map((grade) => (
                <option key={grade} value={grade}>
                  {QA_PARTNER_GRADE_LABELS[grade]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">후속조치</span>
            <select
              value={followUpFilter}
              onChange={(event) => setFollowUpFilter(event.target.value as "all" | QaPartnerFollowUpStatus)}
              className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
            >
              <option value="all">전체</option>
              {QA_PARTNER_FOLLOW_UP_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>
                  {QA_PARTNER_FOLLOW_UP_STATUS_LABELS[status]}
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
                {editingId ? "협력사 품질보증 평가 수정" : "협력사 품질보증 평가 등록"}
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                평가표 점수로 등급과 리스크가 자동 계산되며, 필요 시 CAPA와 연결할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleLoadDefaultCriteria}
                className="rounded-md border border-border bg-background-soft px-4 py-2 text-sm font-medium text-foreground hover:bg-background-card"
              >
                기본 기준 불러오기
              </button>
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
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">등록된 협력사 선택</span>
              <select
                value={selectedPartnerOptionKey}
                onChange={(event) => handlePartnerOptionChange(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                <option value="">선택 안함</option>
                {partnerOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.partnerName} · {QA_PARTNER_CATEGORY_LABELS[option.partnerCategory]}
                  </option>
                ))}
              </select>
            </label>
            <FormInput
              label="협력사명"
              value={form.partnerName}
              onChange={(event) => handlePartnerNameChange(event.target.value)}
              required
            />
            <FormInput
              label="협력사 코드"
              value={form.partnerCode}
              onChange={(event) => updateFormField("partnerCode", event.target.value.toUpperCase())}
              placeholder="등록 코드가 없으면 비워둘 수 있습니다."
            />
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">협력사 구분</span>
              <select
                value={form.partnerCategory}
                onChange={(event) => updateFormField("partnerCategory", event.target.value as QaPartnerCategory)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_PARTNER_CATEGORY_VALUES.map((category) => (
                  <option key={category} value={category}>
                    {QA_PARTNER_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">평가 유형</span>
              <select
                value={form.evaluationType}
                onChange={(event) => updateFormField("evaluationType", event.target.value as QaPartnerEvaluationType)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_PARTNER_EVALUATION_TYPE_VALUES.map((type) => (
                  <option key={type} value={type}>
                    {QA_PARTNER_EVALUATION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">평가 상태</span>
              <select
                value={form.status}
                onChange={(event) => updateFormField("status", event.target.value as QaPartnerAssuranceStatus)}
                className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
              >
                {QA_PARTNER_ASSURANCE_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {QA_PARTNER_ASSURANCE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>
            <FormInput
              label="평가일"
              type="date"
              value={form.evaluationDate}
              onChange={(event) => updateFormField("evaluationDate", event.target.value)}
              required
            />
            <FormInput
              label="차기 평가 예정일"
              type="date"
              value={form.nextReviewDate}
              onChange={(event) => updateFormField("nextReviewDate", event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <span className="block text-sm font-medium text-foreground">평가자</span>
              <div className="flex flex-col gap-2 md:flex-row">
                <input
                  readOnly
                  value={formatSiteMemberSummary(selectedEvaluator, form.evaluatorName)}
                  placeholder="현장 인력에서 선택"
                  className="h-9 flex-1 rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMemberQuery("");
                    setEvaluatorPickerOpen(true);
                  }}
                  className="rounded-md border border-border bg-background-soft px-3 py-2 text-sm font-medium text-foreground hover:bg-background-card"
                >
                  사용자 선택
                </button>
              </div>
            </div>
            <FormInput
              label="협력사 담당자"
              value={form.contactName}
              onChange={(event) => updateFormField("contactName", event.target.value)}
              placeholder="현장 응대 담당자"
            />
            <FormInput
              label="연락처"
              value={form.contactPhone}
              onChange={(event) => updateFormField("contactPhone", event.target.value)}
              placeholder="010-0000-0000"
            />
          </div>

          <label className="space-y-1">
            <span className="block text-sm font-medium text-foreground">평가 범위</span>
            <textarea
              value={form.scopeSummary}
              onChange={(event) => updateFormField("scopeSummary", event.target.value)}
              rows={3}
              required
              className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
              placeholder="대상 자재, 공종, 평가 목적, 기간 등을 입력하세요."
            />
          </label>

          <div className="rounded-xl border border-border bg-background-soft p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">평가 항목</h3>
                <p className="mt-1 text-xs text-foreground-muted">
                  배점/점수에 따라 등급과 리스크가 자동 계산됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddAssessmentItem}
                className="rounded-md border border-border bg-background-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-background-soft"
              >
                평가 항목 추가
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-background-card p-3">
                <p className="text-xs font-medium text-foreground-muted">총점</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {assessmentScoreSummary.totalScore} / {assessmentScoreSummary.maxScore}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background-card p-3">
                <p className="text-xs font-medium text-foreground-muted">등급</p>
                <div className="mt-1">
                  <GradePill grade={assessmentScoreSummary.grade} />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background-card p-3">
                <p className="text-xs font-medium text-foreground-muted">리스크</p>
                <div className="mt-1">
                  <RiskPill riskLevel={assessmentScoreSummary.riskLevel} />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background-card p-3">
                <p className="text-xs font-medium text-foreground-muted">개선 필요 항목</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {assessmentScoreSummary.improvementCount}건
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {form.assessmentItems.map((item, index) => (
                <div key={item.itemId} className="rounded-lg border border-border bg-background-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">평가 항목 {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveAssessmentItem(item.itemId)}
                      disabled={form.assessmentItems.length === 1}
                      className="rounded-md border border-border px-3 py-1 text-xs text-foreground-muted hover:bg-background-soft disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-4">
                    <label className="space-y-1">
                      <span className="block text-sm font-medium text-foreground">구분</span>
                      <select
                        value={item.criterionCategory}
                        onChange={(event) =>
                          updateAssessmentItemField(
                            item.itemId,
                            "criterionCategory",
                            event.target.value as QaPartnerCriterionCategory,
                          )
                        }
                        className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                      >
                        {QA_PARTNER_CRITERION_CATEGORY_VALUES.map((category) => (
                          <option key={category} value={category}>
                            {QA_PARTNER_CRITERION_CATEGORY_LABELS[category]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <FormInput
                      label="항목명"
                      value={item.criterionTitle}
                      onChange={(event) => updateAssessmentItemField(item.itemId, "criterionTitle", event.target.value)}
                      required
                    />
                    <FormInput
                      label="배점"
                      value={item.maxScore}
                      onChange={(event) =>
                        updateAssessmentItemField(
                          item.itemId,
                          "maxScore",
                          event.target.value.replace(/[^0-9]/g, "").slice(0, 3),
                        )
                      }
                      inputMode="numeric"
                      required
                    />
                    <FormInput
                      label="점수"
                      value={item.score}
                      onChange={(event) =>
                        updateAssessmentItemField(
                          item.itemId,
                          "score",
                          event.target.value.replace(/[^0-9]/g, "").slice(0, 3),
                        )
                      }
                      inputMode="numeric"
                      required
                    />
                    <label className="space-y-1 lg:col-span-3">
                      <span className="block text-sm font-medium text-foreground">평가 메모</span>
                      <textarea
                        value={item.comment}
                        onChange={(event) => updateAssessmentItemField(item.itemId, "comment", event.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                        placeholder="증빙, 보완 필요사항, 평가 근거"
                      />
                    </label>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">개선 필요 여부</p>
                      <label className="inline-flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={item.requiresImprovement}
                          onChange={(event) =>
                            updateAssessmentItemField(item.itemId, "requiresImprovement", event.target.checked)
                          }
                          className="h-4 w-4 rounded border border-border"
                        />
                        <span>후속조치 필요</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-foreground">평가 요약</span>
              <textarea
                value={form.summary}
                onChange={(event) => updateFormField("summary", event.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                placeholder="협력사 품질 수준, 강점/약점, 종합 판단"
              />
            </label>
            <div className="space-y-3 rounded-xl border border-border bg-background-soft p-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">후속조치 / CAPA</h3>
                <p className="mt-1 text-xs text-foreground-muted">
                  등급 {QA_PARTNER_GRADE_LABELS[assessmentScoreSummary.grade]} / 개선 필요 항목{" "}
                  {assessmentScoreSummary.improvementCount}건 기준으로 후속조치 필요 여부를 검토하세요.
                </p>
              </div>

              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">후속조치 상태</span>
                <select
                  value={form.followUpStatus}
                  onChange={(event) =>
                    handleFollowUpStatusChange(event.target.value as QaPartnerFollowUpStatus)
                  }
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground"
                >
                  {QA_PARTNER_FOLLOW_UP_STATUS_VALUES.map((status) => (
                    <option key={status} value={status}>
                      {QA_PARTNER_FOLLOW_UP_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">개선 요청</span>
                <textarea
                  value={form.improvementRequest}
                  onChange={(event) => updateFormField("improvementRequest", event.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-border bg-background-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-border-strong focus:ring-2 focus:ring-primary/15"
                  placeholder="시정 요청, 재평가 기준, 제출 요청 자료"
                />
              </label>

              <label className="space-y-1">
                <span className="block text-sm font-medium text-foreground">연결 CAPA</span>
                <select
                  value={form.linkedCapaId}
                  onChange={(event) => updateFormField("linkedCapaId", event.target.value)}
                  disabled={form.followUpStatus === "not_required"}
                  className="h-9 w-full rounded-md border border-border bg-background-card px-3 text-sm text-foreground disabled:opacity-60"
                >
                  <option value="">선택 안함</option>
                  {capaOptions.map((option) => (
                    <option key={option._id} value={option._id}>
                      {buildCapaLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              {form.linkedCapaId ? (
                <Link href="/qa/capa" className="inline-flex text-sm font-medium text-sky-700 hover:underline">
                  CAPA 화면에서 연결 건 보기
                </Link>
              ) : null}

              {assessmentScoreSummary.requiresFollowUp && form.followUpStatus === "not_required" ? (
                <p className="text-sm text-danger">현재 점수 또는 개선 필요 항목 기준으로 후속조치 등록이 필요합니다.</p>
              ) : null}
              {optionError ? <p className="text-sm text-danger">{optionError}</p> : null}
              {isOptionLoading ? <p className="text-sm text-foreground-muted">협력사/CAPA 옵션을 불러오는 중입니다.</p> : null}
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

      <DataTable<PartnerAssuranceItem>
        columns={columns}
        data={items}
        rowKey={(row) => row._id}
        emptyMessage={
          isLoading ? "협력사 품질보증 평가를 불러오는 중입니다." : "등록된 협력사 품질보증 평가가 없습니다."
        }
        onRowClick={(row) => setSelectedItem(row)}
        getRowAriaLabel={(row) => `${row.partnerName} 협력사 품질보증 평가 상세 보기`}
      />

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadItems(nextPage)} />
      ) : null}

      <Modal open={evaluatorPickerOpen} title="평가자 선택" onClose={() => setEvaluatorPickerOpen(false)}>
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
                  onClick={() => handleSelectEvaluator(member)}
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

      <Modal open={selectedItem !== null} title="협력사 품질보증 평가 상세" onClose={() => setSelectedItem(null)}>
        {selectedItem ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background-soft p-3 text-sm">
              <div>
                <p className="text-xs font-medium text-foreground-muted">평가일</p>
                <p className="mt-1 text-foreground">{formatDate(selectedItem.evaluationDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">차기 평가 예정일</p>
                <p className="mt-1 text-foreground">{formatDate(selectedItem.nextReviewDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">등급</p>
                <div className="mt-1">
                  <GradePill grade={selectedItem.grade} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">리스크</p>
                <div className="mt-1">
                  <RiskPill riskLevel={selectedItem.riskLevel} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">평가 상태</p>
                <div className="mt-1">
                  <StatusPill status={selectedItem.status} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">후속조치</p>
                <div className="mt-1">
                  <FollowUpPill status={selectedItem.followUpStatus} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">협력사</p>
              <p className="mt-1 font-medium text-foreground">{selectedItem.partnerName}</p>
              <p className="mt-1 text-sm text-foreground-muted">
                {QA_PARTNER_CATEGORY_LABELS[selectedItem.partnerCategory]} ·{" "}
                {QA_PARTNER_EVALUATION_TYPE_LABELS[selectedItem.evaluationType]}
                {selectedItem.partnerCode ? ` · ${selectedItem.partnerCode}` : ""}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-foreground-muted">평가자</p>
                <p className="mt-1 text-sm text-foreground">{selectedItem.evaluatorName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-muted">협력사 담당자</p>
                <p className="mt-1 text-sm text-foreground">
                  {selectedItem.contactName || "미지정"}
                  {selectedItem.contactPhone ? ` · ${selectedItem.contactPhone}` : ""}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">평가 범위</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.scopeSummary}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">평가 요약</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.summary || "평가 요약 없음"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">총점</p>
              <p className="mt-1 text-sm text-foreground">
                {selectedItem.totalScore} / {selectedItem.maxScore}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground-muted">평가 항목</p>
              {selectedItem.assessmentItems.map((assessment) => (
                <div key={assessment.itemId} className="rounded-lg border border-border bg-background-soft p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{assessment.criterionTitle}</p>
                    <p className="text-xs text-foreground-muted">
                      {assessment.score} / {assessment.maxScore}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-foreground-muted">
                    {QA_PARTNER_CRITERION_CATEGORY_LABELS[assessment.criterionCategory]}
                  </p>
                  {assessment.comment ? (
                    <p className="mt-2 text-sm text-foreground">{assessment.comment}</p>
                  ) : null}
                  {assessment.requiresImprovement ? (
                    <p className="mt-2 text-xs font-medium text-rose-700">개선 필요</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium text-foreground-muted">개선 요청</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {selectedItem.improvementRequest || "개선 요청 없음"}
              </p>
              {selectedItem.linkedCapaId ? (
                <Link href="/qa/capa" className="mt-2 inline-flex text-sm font-medium text-sky-700 hover:underline">
                  CAPA 연결 보기 · {selectedItem.linkedCapaId}
                </Link>
              ) : null}
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
        title="협력사 품질보증 평가 삭제"
        onClose={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">아래 협력사 품질보증 평가를 삭제하시겠습니까?</p>
            <div className="rounded-lg border border-border bg-background-soft p-3 text-sm text-foreground">
              <p className="font-medium">{deleteTarget.partnerName}</p>
              <p className="mt-1 text-foreground-muted">
                {formatDate(deleteTarget.evaluationDate)} · {QA_PARTNER_GRADE_LABELS[deleteTarget.grade]}
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
