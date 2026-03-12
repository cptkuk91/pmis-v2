import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QA_PARTNER_ASSURANCE_STATUS_VALUES,
  QA_PARTNER_CATEGORY_VALUES,
  QA_PARTNER_CRITERION_CATEGORY_VALUES,
  QA_PARTNER_EVALUATION_TYPE_VALUES,
  QA_PARTNER_FOLLOW_UP_STATUS_VALUES,
  QA_PARTNER_SOURCE_VALUES,
  getQaPartnerGrade,
  getQaPartnerRiskLevel,
  isQaPartnerAssuranceStatus,
  isQaPartnerCategory,
  isQaPartnerCriterionCategory,
  isQaPartnerEvaluationType,
  isQaPartnerFollowUpStatus,
  isQaPartnerSource,
  needsQaPartnerFollowUp,
  type QaPartnerAssuranceStatus,
  type QaPartnerCategory,
  type QaPartnerCriterionCategory,
  type QaPartnerEvaluationType,
  type QaPartnerFollowUpStatus,
  type QaPartnerGrade,
  type QaPartnerRiskLevel,
  type QaPartnerSource,
} from "@/lib/qa-partner-assurance";

type QaPartnerAssessmentItemPayload = {
  itemId: string;
  criterionCategory: QaPartnerCriterionCategory;
  criterionTitle: string;
  maxScore: number;
  score: number;
  comment: string;
  requiresImprovement: boolean;
};

export type QaPartnerAssurancePayload = {
  partnerCode: string;
  partnerName: string;
  partnerSource: QaPartnerSource;
  partnerCategory: QaPartnerCategory;
  evaluationType: QaPartnerEvaluationType;
  status: QaPartnerAssuranceStatus;
  evaluationDate: Date;
  nextReviewDate: Date | null;
  evaluatorName: string;
  evaluatorMemberId: string;
  contactName: string;
  contactPhone: string;
  scopeSummary: string;
  summary: string;
  improvementRequest: string;
  followUpStatus: QaPartnerFollowUpStatus;
  linkedCapaId: string;
  assessmentItems: QaPartnerAssessmentItemPayload[];
  totalScore: number;
  maxScore: number;
  grade: QaPartnerGrade;
  riskLevel: QaPartnerRiskLevel;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function parseDate(value: unknown, fieldName: string, required = false): Date | null {
  const raw = normalizeText(value);
  if (!raw) {
    if (required) {
      throw VALIDATION_ERROR(`${fieldName}은(는) 필수입니다.`);
    }
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldName} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

function parseStatus(value: unknown): QaPartnerAssuranceStatus {
  const raw = normalizeText(value) || "draft";
  if (!isQaPartnerAssuranceStatus(raw)) {
    throw VALIDATION_ERROR(`평가 상태는 ${QA_PARTNER_ASSURANCE_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseCategory(value: unknown): QaPartnerCategory {
  const raw = normalizeText(value) || "subcontractor";
  if (!isQaPartnerCategory(raw)) {
    throw VALIDATION_ERROR(`협력사 구분은 ${QA_PARTNER_CATEGORY_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseSource(value: unknown): QaPartnerSource {
  const raw = normalizeText(value) || "manual";
  if (!isQaPartnerSource(raw)) {
    throw VALIDATION_ERROR(`협력사 출처는 ${QA_PARTNER_SOURCE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseEvaluationType(value: unknown): QaPartnerEvaluationType {
  const raw = normalizeText(value) || "regular";
  if (!isQaPartnerEvaluationType(raw)) {
    throw VALIDATION_ERROR(`평가 유형은 ${QA_PARTNER_EVALUATION_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseFollowUpStatus(value: unknown): QaPartnerFollowUpStatus {
  const raw = normalizeText(value) || "not_required";
  if (!isQaPartnerFollowUpStatus(raw)) {
    throw VALIDATION_ERROR(
      `후속조치 상태는 ${QA_PARTNER_FOLLOW_UP_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`,
    );
  }
  return raw;
}

function parseScore(value: unknown, fieldName: string, min = 0, max = 100) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw VALIDATION_ERROR(`${fieldName} 값이 올바르지 않습니다.`);
  }
  return numeric;
}

function normalizeAssessmentItemId(value: unknown, index: number) {
  const raw = normalizeText(value);
  return raw || `partner-assessment-${Date.now()}-${index + 1}`;
}

function normalizeAssessmentItem(value: unknown, index: number): QaPartnerAssessmentItemPayload {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const criterionTitle = normalizeText(item.criterionTitle);
  const comment = normalizeText(item.comment);
  const criterionCategoryRaw = normalizeText(item.criterionCategory) || "quality_system";

  if (!criterionTitle) {
    throw VALIDATION_ERROR(`평가 항목 ${index + 1}의 항목명은 필수입니다.`);
  }
  if (!isQaPartnerCriterionCategory(criterionCategoryRaw)) {
    throw VALIDATION_ERROR(
      `평가 항목 ${index + 1}의 구분은 ${QA_PARTNER_CRITERION_CATEGORY_VALUES.join(", ")} 중 하나여야 합니다.`,
    );
  }

  const maxScore = parseScore(item.maxScore, `평가 항목 ${index + 1} 최대점수`, 1, 100);
  const score = parseScore(item.score, `평가 항목 ${index + 1} 점수`, 0, maxScore);

  assertNoUnsafeHtml(criterionTitle, `평가 항목 ${index + 1} 항목명`);
  assertNoUnsafeHtml(comment, `평가 항목 ${index + 1} 평가 메모`);

  return {
    itemId: normalizeAssessmentItemId(item.itemId, index),
    criterionCategory: criterionCategoryRaw,
    criterionTitle,
    maxScore,
    score,
    comment,
    requiresImprovement: Boolean(item.requiresImprovement),
  };
}

export function normalizeQaPartnerAssurancePayload(
  body: Record<string, unknown>,
): QaPartnerAssurancePayload {
  const partnerCode = normalizeText(body.partnerCode);
  const partnerName = normalizeText(body.partnerName);
  const evaluatorName = normalizeText(body.evaluatorName);
  const evaluatorMemberId = normalizeText(body.evaluatorMemberId);
  const contactName = normalizeText(body.contactName);
  const contactPhone = normalizeText(body.contactPhone);
  const scopeSummary = normalizeText(body.scopeSummary);
  const summary = normalizeText(body.summary);
  const improvementRequest = normalizeText(body.improvementRequest);
  const linkedCapaId = normalizeText(body.linkedCapaId);
  const assessmentItemsInput = Array.isArray(body.assessmentItems) ? body.assessmentItems : [];

  if (!partnerName) {
    throw VALIDATION_ERROR("협력사명은 필수입니다.");
  }
  if (!evaluatorName) {
    throw VALIDATION_ERROR("평가자는 필수입니다.");
  }
  if (!evaluatorMemberId) {
    throw VALIDATION_ERROR("평가자는 현장 인력에서 선택해야 합니다.");
  }
  if (!mongoose.Types.ObjectId.isValid(evaluatorMemberId)) {
    throw VALIDATION_ERROR("평가자 식별자 형식이 올바르지 않습니다.");
  }
  if (!scopeSummary) {
    throw VALIDATION_ERROR("평가 범위는 필수입니다.");
  }
  if (!assessmentItemsInput.length) {
    throw VALIDATION_ERROR("평가 항목은 최소 1개 이상이어야 합니다.");
  }
  if (linkedCapaId && !mongoose.Types.ObjectId.isValid(linkedCapaId)) {
    throw VALIDATION_ERROR("연결 CAPA 식별자 형식이 올바르지 않습니다.");
  }

  assertNoUnsafeHtml(partnerCode, "협력사 코드");
  assertNoUnsafeHtml(partnerName, "협력사명");
  assertNoUnsafeHtml(evaluatorName, "평가자");
  assertNoUnsafeHtml(contactName, "협력사 담당자");
  assertNoUnsafeHtml(contactPhone, "연락처");
  assertNoUnsafeHtml(scopeSummary, "평가 범위");
  assertNoUnsafeHtml(summary, "평가 요약");
  assertNoUnsafeHtml(improvementRequest, "개선 요청");
  assertNoUnsafeHtml(linkedCapaId, "연결 CAPA ID");

  const partnerSource = parseSource(body.partnerSource);
  const partnerCategory = parseCategory(body.partnerCategory);
  const evaluationType = parseEvaluationType(body.evaluationType);
  const status = parseStatus(body.status);
  const followUpStatus = parseFollowUpStatus(body.followUpStatus);
  const evaluationDate = parseDate(body.evaluationDate, "평가일", true);
  const nextReviewDate = parseDate(body.nextReviewDate, "차기 평가 예정일");
  if (!evaluationDate) {
    throw VALIDATION_ERROR("평가일은 필수입니다.");
  }

  const assessmentItems = assessmentItemsInput.map((item, index) => normalizeAssessmentItem(item, index));
  const totalScore = assessmentItems.reduce((sum, item) => sum + item.score, 0);
  const maxScore = assessmentItems.reduce((sum, item) => sum + item.maxScore, 0);
  const improvementCount = assessmentItems.filter((item) => item.requiresImprovement).length;
  const grade = getQaPartnerGrade(totalScore, maxScore);

  if (needsQaPartnerFollowUp(grade, improvementCount) && followUpStatus === "not_required") {
    throw VALIDATION_ERROR("저평가 또는 개선 필요 항목이 있으면 후속조치를 등록해야 합니다.");
  }
  if (followUpStatus !== "not_required" && !improvementRequest) {
    throw VALIDATION_ERROR("후속조치가 있으면 개선 요청 내용을 입력해야 합니다.");
  }
  if (status === "follow_up" && followUpStatus === "not_required") {
    throw VALIDATION_ERROR("후속조치 상태가 없으면 평가 상태를 후속조치로 둘 수 없습니다.");
  }
  if (status === "completed" && followUpStatus === "requested") {
    throw VALIDATION_ERROR("후속조치 대기 상태에서는 평가를 완료할 수 없습니다.");
  }

  const riskLevel = getQaPartnerRiskLevel(grade, improvementCount, followUpStatus);

  return {
    partnerCode,
    partnerName,
    partnerSource,
    partnerCategory,
    evaluationType,
    status,
    evaluationDate,
    nextReviewDate,
    evaluatorName,
    evaluatorMemberId,
    contactName,
    contactPhone,
    scopeSummary,
    summary,
    improvementRequest: followUpStatus === "not_required" ? "" : improvementRequest,
    followUpStatus,
    linkedCapaId: followUpStatus === "not_required" ? "" : linkedCapaId,
    assessmentItems,
    totalScore,
    maxScore,
    grade,
    riskLevel,
  };
}
