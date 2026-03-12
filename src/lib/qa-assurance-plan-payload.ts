import { VALIDATION_ERROR } from "@/lib/api-error";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QA_ASSURANCE_CHECKPOINT_STATUS_VALUES,
  QA_ASSURANCE_PLAN_STATUS_VALUES,
  isQaAssuranceCheckpointStatus,
  isQaAssurancePlanStatus,
  type QaAssuranceCheckpointStatus,
  type QaAssurancePlanStatus,
} from "@/lib/qa-assurance-plans";

export type QaAssurancePlanPayload = {
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
  checkpoints: Array<{
    checkpointId: string;
    phaseName: string;
    checkpointTitle: string;
    inspectionMethod: string;
    acceptanceCriteria: string;
    referenceProcedure: string;
    ownerName: string;
    ownerMemberId: string;
    status: QaAssuranceCheckpointStatus;
  }>;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCheckpointId(value: unknown, index: number): string {
  const candidate = normalizeText(value);
  return candidate || `checkpoint-${Date.now()}-${index + 1}`;
}

function parseYear(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 2000 || numeric > 2100) {
    throw VALIDATION_ERROR("적용연도는 2000~2100 범위의 정수여야 합니다.");
  }
  return numeric;
}

function parseVersionNo(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99) {
    throw VALIDATION_ERROR("버전은 1~99 범위의 정수여야 합니다.");
  }
  return numeric;
}

function parseStatus(value: unknown): QaAssurancePlanStatus {
  const raw = normalizeText(value) || "draft";
  if (!isQaAssurancePlanStatus(raw)) {
    throw VALIDATION_ERROR(`상태는 ${QA_ASSURANCE_PLAN_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseCheckpointStatus(value: unknown): QaAssuranceCheckpointStatus {
  const raw = normalizeText(value) || "planned";
  if (!isQaAssuranceCheckpointStatus(raw)) {
    throw VALIDATION_ERROR(
      `체크포인트 상태는 ${QA_ASSURANCE_CHECKPOINT_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`,
    );
  }
  return raw;
}

function parseOptionalYear(value: unknown): number | null {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }
  const numeric = Number(raw);
  if (!Number.isInteger(numeric) || numeric < 2000 || numeric > 2100) {
    throw VALIDATION_ERROR("연결된 정책 목표 연도가 올바르지 않습니다.");
  }
  return numeric;
}

function parseOptionalRevision(value: unknown): number | null {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }
  const numeric = Number(raw);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99) {
    throw VALIDATION_ERROR("연결된 정책 목표 개정번호가 올바르지 않습니다.");
  }
  return numeric;
}

function normalizeCheckpoint(value: unknown, index: number) {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const phaseName = normalizeText(item.phaseName);
  const checkpointTitle = normalizeText(item.checkpointTitle);
  const inspectionMethod = normalizeText(item.inspectionMethod);
  const acceptanceCriteria = normalizeText(item.acceptanceCriteria);
  const referenceProcedure = normalizeText(item.referenceProcedure);
  const ownerName = normalizeText(item.ownerName);
  const ownerMemberId = normalizeText(item.ownerMemberId);

  if (!phaseName) {
    throw VALIDATION_ERROR(`체크포인트 ${index + 1}의 공종/공정은 필수입니다.`);
  }
  if (!checkpointTitle) {
    throw VALIDATION_ERROR(`체크포인트 ${index + 1}의 체크포인트명은 필수입니다.`);
  }
  if (!acceptanceCriteria) {
    throw VALIDATION_ERROR(`체크포인트 ${index + 1}의 합격 기준은 필수입니다.`);
  }

  assertNoUnsafeHtml(phaseName, `체크포인트 ${index + 1} 공종/공정`);
  assertNoUnsafeHtml(checkpointTitle, `체크포인트 ${index + 1} 체크포인트명`);
  assertNoUnsafeHtml(inspectionMethod, `체크포인트 ${index + 1} 검사 방법`);
  assertNoUnsafeHtml(acceptanceCriteria, `체크포인트 ${index + 1} 합격 기준`);
  assertNoUnsafeHtml(referenceProcedure, `체크포인트 ${index + 1} 참조 절차`);
  assertNoUnsafeHtml(ownerName, `체크포인트 ${index + 1} 담당자`);

  return {
    checkpointId: normalizeCheckpointId(item.checkpointId, index),
    phaseName,
    checkpointTitle,
    inspectionMethod,
    acceptanceCriteria,
    referenceProcedure,
    ownerName,
    ownerMemberId,
    status: parseCheckpointStatus(item.status),
  };
}

export function normalizeQaAssurancePlanPayload(body: Record<string, unknown>): QaAssurancePlanPayload {
  const planTitle = normalizeText(body.planTitle);
  const scopeSummary = normalizeText(body.scopeSummary);
  const qualityObjectiveSummary = normalizeText(body.qualityObjectiveSummary);
  const revisionReason = normalizeText(body.revisionReason);
  const linkedPolicyGoalTitle = normalizeText(body.linkedPolicyGoalTitle);
  const templateReference = normalizeText(body.templateReference);
  const checkpointsInput = Array.isArray(body.checkpoints) ? body.checkpoints : [];

  if (!planTitle) {
    throw VALIDATION_ERROR("QAP 제목은 필수입니다.");
  }
  if (!scopeSummary) {
    throw VALIDATION_ERROR("적용 범위는 필수입니다.");
  }
  if (!qualityObjectiveSummary) {
    throw VALIDATION_ERROR("품질 목표 요약은 필수입니다.");
  }
  if (!checkpointsInput.length) {
    throw VALIDATION_ERROR("체크포인트는 최소 1개 이상이어야 합니다.");
  }

  assertNoUnsafeHtml(planTitle, "QAP 제목");
  assertNoUnsafeHtml(scopeSummary, "적용 범위");
  assertNoUnsafeHtml(qualityObjectiveSummary, "품질 목표 요약");
  assertNoUnsafeHtml(revisionReason, "개정 사유");
  assertNoUnsafeHtml(linkedPolicyGoalTitle, "연결 정책 목표");
  assertNoUnsafeHtml(templateReference, "문서/템플릿 참조");

  return {
    year: parseYear(body.year),
    versionNo: parseVersionNo(body.versionNo),
    status: parseStatus(body.status),
    planTitle,
    revisionReason,
    linkedPolicyGoalId: normalizeText(body.linkedPolicyGoalId),
    linkedPolicyGoalTitle,
    linkedPolicyGoalYear: parseOptionalYear(body.linkedPolicyGoalYear),
    linkedPolicyGoalRevisionNo: parseOptionalRevision(body.linkedPolicyGoalRevisionNo),
    scopeSummary,
    qualityObjectiveSummary,
    templateReference,
    checkpoints: checkpointsInput.map((item, index) => normalizeCheckpoint(item, index)),
  };
}
