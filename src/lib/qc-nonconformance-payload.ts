import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { isQcAttachmentCategory, type QcAttachmentCategory } from "@/lib/qc-core";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QC_NONCONFORMANCE_OCCURRENCE_TYPE_VALUES,
  QC_NONCONFORMANCE_SEVERITY_VALUES,
  QC_NONCONFORMANCE_SOURCE_TYPE_VALUES,
  QC_NONCONFORMANCE_STATUS_VALUES,
  QC_NONCONFORMANCE_VERIFICATION_RESULT_VALUES,
  getQcNonconformanceSeverityRank,
  isQcNonconformanceOccurrenceType,
  isQcNonconformanceSeverity,
  isQcNonconformanceSourceType,
  isQcNonconformanceStatus,
  isQcNonconformanceVerificationResult,
  type QcNonconformanceOccurrenceType,
  type QcNonconformanceSeverity,
  type QcNonconformanceSourceType,
  type QcNonconformanceStatus,
  type QcNonconformanceVerificationResult,
} from "@/lib/qc-nonconformance";

export type QcNonconformanceAttachmentPayload = {
  fileAssetId: string;
  fileName: string;
  category: QcAttachmentCategory;
  sortOrder: number;
};

export type QcNonconformancePayload = {
  occurrenceType: QcNonconformanceOccurrenceType;
  sourceType: QcNonconformanceSourceType;
  severity: QcNonconformanceSeverity;
  severityRank: number;
  title: string;
  description: string;
  occurrenceDate: Date | null;
  location: string;
  workType: string;
  sourceSummary: string;
  linkedMaterialInspectionId: string;
  linkedProcessInspectionId: string;
  linkedTestReportId: string;
  assigneeName: string;
  assigneeMemberId: string;
  verifierName: string;
  verifierMemberId: string;
  dueDate: Date | null;
  status: QcNonconformanceStatus;
  rootCauseSummary: string;
  containmentAction: string;
  correctiveActionPlan: string;
  preventiveAction: string;
  actionTaken: string;
  verificationResult: QcNonconformanceVerificationResult;
  verificationNote: string;
  verifiedAt: Date | null;
  attachments: QcNonconformanceAttachmentPayload[];
  historyNote: string;
  reminderRequested: boolean;
};

type NormalizeOptions = {
  partial?: boolean;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function parseObjectId(value: unknown, fieldLabel: string): string {
  const raw = normalizeText(value);
  if (!raw) {
    return "";
  }
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    throw VALIDATION_ERROR(`${fieldLabel} 식별자 형식이 올바르지 않습니다.`);
  }
  return raw;
}

function parseDate(value: unknown, fieldLabel: string): Date | null {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldLabel} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

function parseOccurrenceType(value: unknown): QcNonconformanceOccurrenceType {
  const raw = normalizeText(value) || "other";
  if (!isQcNonconformanceOccurrenceType(raw)) {
    throw VALIDATION_ERROR(`발생 구분은 ${QC_NONCONFORMANCE_OCCURRENCE_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseSourceType(value: unknown): QcNonconformanceSourceType {
  const raw = normalizeText(value) || "manual";
  if (!isQcNonconformanceSourceType(raw)) {
    throw VALIDATION_ERROR(`출처 유형은 ${QC_NONCONFORMANCE_SOURCE_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseSeverity(value: unknown): QcNonconformanceSeverity {
  const raw = normalizeText(value) || "medium";
  if (!isQcNonconformanceSeverity(raw)) {
    throw VALIDATION_ERROR(`심각도는 ${QC_NONCONFORMANCE_SEVERITY_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseStatus(value: unknown): QcNonconformanceStatus {
  const raw = normalizeText(value) || "open";
  if (!isQcNonconformanceStatus(raw)) {
    throw VALIDATION_ERROR(`상태는 ${QC_NONCONFORMANCE_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseVerificationResult(value: unknown): QcNonconformanceVerificationResult {
  const raw = normalizeText(value) || "pending";
  if (!isQcNonconformanceVerificationResult(raw)) {
    throw VALIDATION_ERROR(`검증 결과는 ${QC_NONCONFORMANCE_VERIFICATION_RESULT_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseAttachments(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row, index) => {
      const fileAssetId = parseObjectId(row.fileAssetId, "첨부 파일");
      if (!fileAssetId) {
        return null;
      }
      const fileName = normalizeText(row.fileName) || fileAssetId;
      const categoryRaw = normalizeText(row.category) || "other";
      if (!isQcAttachmentCategory(categoryRaw)) {
        throw VALIDATION_ERROR("첨부 구분 값이 올바르지 않습니다.");
      }
      const sortOrderValue = Number(row.sortOrder ?? index);
      const sortOrder = Number.isFinite(sortOrderValue) ? Math.max(0, Math.floor(sortOrderValue)) : index;
      return {
        fileAssetId,
        fileName,
        category: categoryRaw,
        sortOrder,
      };
    })
    .filter((row): row is QcNonconformanceAttachmentPayload => Boolean(row));
}

export function normalizeQcNonconformancePayload(
  body: Record<string, unknown>,
  options: { partial: true },
): Partial<QcNonconformancePayload>;
export function normalizeQcNonconformancePayload(
  body: Record<string, unknown>,
  options?: NormalizeOptions,
): QcNonconformancePayload;
export function normalizeQcNonconformancePayload(
  body: Record<string, unknown>,
  options: NormalizeOptions = {},
) {
  const partial = options.partial ?? false;
  const payload: Partial<QcNonconformancePayload> = {};

  if (!partial || body.occurrenceType !== undefined) {
    payload.occurrenceType = parseOccurrenceType(body.occurrenceType);
  }

  if (!partial || body.sourceType !== undefined) {
    payload.sourceType = parseSourceType(body.sourceType);
  }

  if (!partial || body.severity !== undefined) {
    payload.severity = parseSeverity(body.severity);
    payload.severityRank = getQcNonconformanceSeverityRank(payload.severity);
  }

  if (!partial || body.title !== undefined) {
    const title = normalizeText(body.title);
    if (!title) {
      throw VALIDATION_ERROR("제목은 필수입니다.");
    }
    assertNoUnsafeHtml(title, "제목");
    payload.title = title;
  }

  if (!partial || body.description !== undefined) {
    const description = normalizeText(body.description);
    assertNoUnsafeHtml(description, "부적합 내용");
    payload.description = description;
  }

  if (!partial || body.occurrenceDate !== undefined) {
    payload.occurrenceDate = parseDate(body.occurrenceDate, "발생일");
    if (!partial && !payload.occurrenceDate) {
      throw VALIDATION_ERROR("발생일은 필수입니다.");
    }
  }

  if (!partial || body.location !== undefined) {
    const location = normalizeText(body.location);
    assertNoUnsafeHtml(location, "위치");
    payload.location = location;
  }

  if (!partial || body.workType !== undefined) {
    const workType = normalizeText(body.workType);
    assertNoUnsafeHtml(workType, "공종");
    payload.workType = workType;
  }

  if (!partial || body.sourceSummary !== undefined) {
    const sourceSummary = normalizeText(body.sourceSummary);
    assertNoUnsafeHtml(sourceSummary, "출처 요약");
    payload.sourceSummary = sourceSummary;
  }

  if (!partial || body.linkedMaterialInspectionId !== undefined) {
    payload.linkedMaterialInspectionId = parseObjectId(body.linkedMaterialInspectionId, "자재 검사");
  }

  if (!partial || body.linkedProcessInspectionId !== undefined) {
    payload.linkedProcessInspectionId = parseObjectId(body.linkedProcessInspectionId, "공정 검사");
  }

  if (!partial || body.linkedTestReportId !== undefined) {
    payload.linkedTestReportId = parseObjectId(body.linkedTestReportId, "시험 성적서");
  }

  if (!partial || body.assigneeName !== undefined) {
    const assigneeName = normalizeText(body.assigneeName);
    assertNoUnsafeHtml(assigneeName, "조치 담당자");
    payload.assigneeName = assigneeName;
  }

  if (!partial || body.assigneeMemberId !== undefined) {
    payload.assigneeMemberId = parseObjectId(body.assigneeMemberId, "조치 담당자");
  }

  if (!partial || body.verifierName !== undefined) {
    const verifierName = normalizeText(body.verifierName);
    assertNoUnsafeHtml(verifierName, "검증자");
    payload.verifierName = verifierName;
  }

  if (!partial || body.verifierMemberId !== undefined) {
    payload.verifierMemberId = parseObjectId(body.verifierMemberId, "검증자");
  }

  if (!partial || body.dueDate !== undefined) {
    payload.dueDate = parseDate(body.dueDate, "조치 기한");
    if (!partial && !payload.dueDate) {
      throw VALIDATION_ERROR("조치 기한은 필수입니다.");
    }
  }

  if (!partial || body.status !== undefined) {
    payload.status = parseStatus(body.status);
  }

  if (!partial || body.rootCauseSummary !== undefined) {
    const rootCauseSummary = normalizeText(body.rootCauseSummary);
    assertNoUnsafeHtml(rootCauseSummary, "원인분석");
    payload.rootCauseSummary = rootCauseSummary;
  }

  if (!partial || body.containmentAction !== undefined) {
    const containmentAction = normalizeText(body.containmentAction);
    assertNoUnsafeHtml(containmentAction, "임시조치");
    payload.containmentAction = containmentAction;
  }

  if (!partial || body.correctiveActionPlan !== undefined) {
    const correctiveActionPlan = normalizeText(body.correctiveActionPlan);
    assertNoUnsafeHtml(correctiveActionPlan, "시정조치 계획");
    payload.correctiveActionPlan = correctiveActionPlan;
  }

  if (!partial || body.preventiveAction !== undefined) {
    const preventiveAction = normalizeText(body.preventiveAction);
    assertNoUnsafeHtml(preventiveAction, "재발방지 대책");
    payload.preventiveAction = preventiveAction;
  }

  if (!partial || body.actionTaken !== undefined) {
    const actionTaken = normalizeText(body.actionTaken);
    assertNoUnsafeHtml(actionTaken, "조치 결과");
    payload.actionTaken = actionTaken;
  }

  if (!partial || body.verificationResult !== undefined) {
    payload.verificationResult = parseVerificationResult(body.verificationResult);
  }

  if (!partial || body.verificationNote !== undefined) {
    const verificationNote = normalizeText(body.verificationNote);
    assertNoUnsafeHtml(verificationNote, "검증 메모");
    payload.verificationNote = verificationNote;
  }

  if (!partial || body.verifiedAt !== undefined) {
    payload.verifiedAt = parseDate(body.verifiedAt, "검증일");
  }

  if (!partial || body.attachments !== undefined) {
    payload.attachments = parseAttachments(body.attachments);
  }

  if (!partial || body.historyNote !== undefined) {
    const historyNote = normalizeText(body.historyNote);
    assertNoUnsafeHtml(historyNote, "이력 메모");
    payload.historyNote = historyNote;
  }

  if (!partial || body.reminderRequested !== undefined) {
    payload.reminderRequested = Boolean(body.reminderRequested);
  }

  return payload as QcNonconformancePayload;
}
