import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QA_CAPA_ACTION_TYPE_VALUES,
  QA_CAPA_PRIORITY_VALUES,
  QA_CAPA_SOURCE_TYPE_VALUES,
  QA_CAPA_STATUS_VALUES,
  QA_CAPA_WHY_ANALYSIS_STEPS,
  canTransitionQaCapaStatus,
  isQaCapaActionType,
  isQaCapaPriority,
  isQaCapaSourceType,
  isQaCapaStatus,
  type QaCapaActionType,
  type QaCapaPriority,
  type QaCapaSourceType,
  type QaCapaStatus,
} from "@/lib/qa-capa";

export type QaCapaPayload = {
  title: string;
  sourceType: QaCapaSourceType;
  sourceSummary: string;
  sourceAuditId: string;
  sourceChecklistId: string;
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
  dueDate: Date;
  verifiedAt: Date | null;
  verificationNote: string;
};

type NormalizeOptions = {
  previousStatus?: QaCapaStatus | null;
};

function normalizeText(value: unknown): string {
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

function normalizeWhyAnalysis(value: unknown) {
  const input = Array.isArray(value) ? value : [];
  const items = QA_CAPA_WHY_ANALYSIS_STEPS.map((_, index) => normalizeText(input[index] ?? ""));

  items.forEach((item, index) => {
    assertNoUnsafeHtml(item, `5Why ${index + 1}`);
  });

  return items;
}

function parseSourceType(value: unknown): QaCapaSourceType {
  const raw = normalizeText(value) || "manual";
  if (!isQaCapaSourceType(raw)) {
    throw VALIDATION_ERROR(`출처 유형은 ${QA_CAPA_SOURCE_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseActionType(value: unknown): QaCapaActionType {
  const raw = normalizeText(value) || "corrective";
  if (!isQaCapaActionType(raw)) {
    throw VALIDATION_ERROR(`조치 유형은 ${QA_CAPA_ACTION_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parsePriority(value: unknown): QaCapaPriority {
  const raw = normalizeText(value) || "medium";
  if (!isQaCapaPriority(raw)) {
    throw VALIDATION_ERROR(`우선순위는 ${QA_CAPA_PRIORITY_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseStatus(value: unknown): QaCapaStatus {
  const raw = normalizeText(value) || "open";
  if (!isQaCapaStatus(raw)) {
    throw VALIDATION_ERROR(`상태는 ${QA_CAPA_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function validateMemberId(value: string, fieldName: string, required = false) {
  if (!value) {
    if (required) {
      throw VALIDATION_ERROR(`${fieldName}는 현장 인력에서 선택해야 합니다.`);
    }
    return;
  }
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw VALIDATION_ERROR(`${fieldName} 식별자 형식이 올바르지 않습니다.`);
  }
}

export function normalizeQaCapaPayload(
  body: Record<string, unknown>,
  options: NormalizeOptions = {},
): QaCapaPayload {
  const title = normalizeText(body.title);
  const sourceSummary = normalizeText(body.sourceSummary);
  const sourceAuditId = normalizeText(body.sourceAuditId);
  const sourceChecklistId = normalizeText(body.sourceChecklistId);
  const rootCauseSummary = normalizeText(body.rootCauseSummary);
  const actionPlan = normalizeText(body.actionPlan);
  const executionNote = normalizeText(body.executionNote);
  const assigneeName = normalizeText(body.assigneeName);
  const assigneeMemberId = normalizeText(body.assigneeMemberId);
  const verifierName = normalizeText(body.verifierName);
  const verifierMemberId = normalizeText(body.verifierMemberId);
  const verificationNote = normalizeText(body.verificationNote);

  const sourceType = parseSourceType(body.sourceType);
  const actionType = parseActionType(body.actionType);
  const priority = parsePriority(body.priority);
  const status = parseStatus(body.status);

  if (options.previousStatus && !canTransitionQaCapaStatus(options.previousStatus, status)) {
    throw VALIDATION_ERROR(`상태는 ${options.previousStatus}에서 ${status}(으)로 변경할 수 없습니다.`);
  }

  if (!title) {
    throw VALIDATION_ERROR("CAPA 제목은 필수입니다.");
  }
  if (!rootCauseSummary) {
    throw VALIDATION_ERROR("발생 원인은 필수입니다.");
  }
  if (!actionPlan) {
    throw VALIDATION_ERROR("조치 계획은 필수입니다.");
  }
  if (!assigneeName) {
    throw VALIDATION_ERROR("조치 담당자는 필수입니다.");
  }
  if (!assigneeMemberId) {
    throw VALIDATION_ERROR("조치 담당자는 현장 인력에서 선택해야 합니다.");
  }

  validateMemberId(assigneeMemberId, "조치 담당자", true);
  validateMemberId(verifierMemberId, "검증자");

  if (sourceType === "manual") {
    if (!sourceSummary) {
      throw VALIDATION_ERROR("수동 등록 출처 설명은 필수입니다.");
    }
  } else {
    if (!sourceAuditId || !mongoose.Types.ObjectId.isValid(sourceAuditId)) {
      throw VALIDATION_ERROR("심사 연계 CAPA는 유효한 심사 식별자가 필요합니다.");
    }
    if (!sourceChecklistId) {
      throw VALIDATION_ERROR("심사 연계 CAPA는 점검 항목 식별자가 필요합니다.");
    }
  }

  if (verifierName && !verifierMemberId) {
    throw VALIDATION_ERROR("검증자는 현장 인력에서 선택해야 합니다.");
  }
  if (verifierMemberId && !verifierName) {
    throw VALIDATION_ERROR("검증자 이름이 필요합니다.");
  }

  assertNoUnsafeHtml(title, "CAPA 제목");
  assertNoUnsafeHtml(sourceSummary, "출처 설명");
  assertNoUnsafeHtml(sourceChecklistId, "심사 점검 항목 ID");
  assertNoUnsafeHtml(rootCauseSummary, "발생 원인");
  assertNoUnsafeHtml(actionPlan, "조치 계획");
  assertNoUnsafeHtml(executionNote, "실행 내역");
  assertNoUnsafeHtml(assigneeName, "조치 담당자");
  assertNoUnsafeHtml(verifierName, "검증자");
  assertNoUnsafeHtml(verificationNote, "검증 메모");

  const dueDate = parseDate(body.dueDate, "조치 기한", true);
  if (!dueDate) {
    throw VALIDATION_ERROR("조치 기한은 필수입니다.");
  }

  const whyAnalysis = normalizeWhyAnalysis(body.whyAnalysis);

  if (status === "verification" && !executionNote) {
    throw VALIDATION_ERROR("검증대기로 넘기려면 실행 내역을 입력해야 합니다.");
  }

  let verifiedAt = parseDate(body.verifiedAt, "검증일");
  if (status === "completed") {
    if (!executionNote) {
      throw VALIDATION_ERROR("완료 처리 전 실행 내역을 입력해야 합니다.");
    }
    if (!verifierName || !verifierMemberId) {
      throw VALIDATION_ERROR("완료 처리 전 검증자를 지정해야 합니다.");
    }
    if (!verificationNote) {
      throw VALIDATION_ERROR("완료 처리 전 검증 메모를 입력해야 합니다.");
    }
    verifiedAt ??= new Date();
  } else {
    verifiedAt = null;
  }

  return {
    title,
    sourceType,
    sourceSummary: sourceType === "manual" ? sourceSummary : "",
    sourceAuditId: sourceType === "audit" ? sourceAuditId : "",
    sourceChecklistId: sourceType === "audit" ? sourceChecklistId : "",
    actionType,
    priority,
    status,
    rootCauseSummary,
    whyAnalysis,
    actionPlan,
    executionNote,
    assigneeName,
    assigneeMemberId,
    verifierName,
    verifierMemberId,
    dueDate,
    verifiedAt,
    verificationNote,
  };
}
