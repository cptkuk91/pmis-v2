import { VALIDATION_ERROR } from "@/lib/api-error";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QC_ITP_HOLD_POINT_VALUES,
  QC_ITP_ITEM_TYPE_VALUES,
  QC_ITP_STATUS_VALUES,
  isQcItpHoldPoint,
  isQcItpItemType,
  isQcItpStatus,
  type QcItpHoldPoint,
  type QcItpItemType,
  type QcItpStatus,
} from "@/lib/qc-itp";

export type QcItpPayload = {
  year: number;
  versionNo: number;
  status: QcItpStatus;
  planTitle: string;
  workType: string;
  processStep: string;
  scopeSummary: string;
  revisionReason: string;
  referenceDrawingNo: string;
  referenceSpec: string;
  notes: string;
  checkpoints: Array<{
    checkpointId: string;
    phaseName: string;
    checkpointTitle: string;
    checkpointType: QcItpItemType;
    holdPoint: QcItpHoldPoint;
    timing: string;
    frequency: string;
    acceptanceCriteria: string;
    referenceCode: string;
    ownerName: string;
    ownerMemberId: string;
  }>;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
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

function parseStatus(value: unknown): QcItpStatus {
  const raw = normalizeText(value) || "draft";
  if (!isQcItpStatus(raw)) {
    throw VALIDATION_ERROR(`상태는 ${QC_ITP_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseCheckpointType(value: unknown): QcItpItemType {
  const raw = normalizeText(value) || "inspection";
  if (!isQcItpItemType(raw)) {
    throw VALIDATION_ERROR(`체크포인트 유형은 ${QC_ITP_ITEM_TYPE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseHoldPoint(value: unknown): QcItpHoldPoint {
  const raw = normalizeText(value) || "none";
  if (!isQcItpHoldPoint(raw)) {
    throw VALIDATION_ERROR(`Hold/Witness 값은 ${QC_ITP_HOLD_POINT_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function normalizeCheckpointId(value: unknown, index: number): string {
  const checkpointId = normalizeText(value);
  return checkpointId || `itp-checkpoint-${Date.now()}-${index + 1}`;
}

function normalizeCheckpoint(value: unknown, index: number) {
  const item = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const phaseName = normalizeText(item.phaseName);
  const checkpointTitle = normalizeText(item.checkpointTitle);
  const timing = normalizeText(item.timing);
  const frequency = normalizeText(item.frequency);
  const acceptanceCriteria = normalizeText(item.acceptanceCriteria);
  const referenceCode = normalizeText(item.referenceCode);
  const ownerName = normalizeText(item.ownerName);
  const ownerMemberId = normalizeText(item.ownerMemberId);

  if (!phaseName) {
    throw VALIDATION_ERROR(`체크포인트 ${index + 1}의 세부 공정은 필수입니다.`);
  }
  if (!checkpointTitle) {
    throw VALIDATION_ERROR(`체크포인트 ${index + 1}의 검사항목은 필수입니다.`);
  }
  if (!acceptanceCriteria) {
    throw VALIDATION_ERROR(`체크포인트 ${index + 1}의 판정 기준은 필수입니다.`);
  }

  assertNoUnsafeHtml(phaseName, `체크포인트 ${index + 1} 세부 공정`);
  assertNoUnsafeHtml(checkpointTitle, `체크포인트 ${index + 1} 검사항목`);
  assertNoUnsafeHtml(timing, `체크포인트 ${index + 1} 검사 시점`);
  assertNoUnsafeHtml(frequency, `체크포인트 ${index + 1} 빈도`);
  assertNoUnsafeHtml(acceptanceCriteria, `체크포인트 ${index + 1} 판정 기준`);
  assertNoUnsafeHtml(referenceCode, `체크포인트 ${index + 1} 참조 기준`);
  assertNoUnsafeHtml(ownerName, `체크포인트 ${index + 1} 담당자`);

  return {
    checkpointId: normalizeCheckpointId(item.checkpointId, index),
    phaseName,
    checkpointTitle,
    checkpointType: parseCheckpointType(item.checkpointType),
    holdPoint: parseHoldPoint(item.holdPoint),
    timing,
    frequency,
    acceptanceCriteria,
    referenceCode,
    ownerName,
    ownerMemberId,
  };
}

export function normalizeQcItpPayload(body: Record<string, unknown>): QcItpPayload {
  const planTitle = normalizeText(body.planTitle);
  const workType = normalizeText(body.workType);
  const processStep = normalizeText(body.processStep);
  const scopeSummary = normalizeText(body.scopeSummary);
  const revisionReason = normalizeText(body.revisionReason);
  const referenceDrawingNo = normalizeText(body.referenceDrawingNo);
  const referenceSpec = normalizeText(body.referenceSpec);
  const notes = normalizeText(body.notes);
  const checkpointsInput = Array.isArray(body.checkpoints) ? body.checkpoints : [];

  if (!planTitle) {
    throw VALIDATION_ERROR("ITP 제목은 필수입니다.");
  }
  if (!workType) {
    throw VALIDATION_ERROR("공종은 필수입니다.");
  }
  if (!processStep) {
    throw VALIDATION_ERROR("공정 단계는 필수입니다.");
  }
  if (!scopeSummary) {
    throw VALIDATION_ERROR("적용 범위는 필수입니다.");
  }
  if (!checkpointsInput.length) {
    throw VALIDATION_ERROR("체크포인트는 최소 1개 이상이어야 합니다.");
  }

  assertNoUnsafeHtml(planTitle, "ITP 제목");
  assertNoUnsafeHtml(workType, "공종");
  assertNoUnsafeHtml(processStep, "공정 단계");
  assertNoUnsafeHtml(scopeSummary, "적용 범위");
  assertNoUnsafeHtml(revisionReason, "개정 사유");
  assertNoUnsafeHtml(referenceDrawingNo, "참조 도면");
  assertNoUnsafeHtml(referenceSpec, "참조 시방");
  assertNoUnsafeHtml(notes, "비고");

  return {
    year: parseYear(body.year),
    versionNo: parseVersionNo(body.versionNo),
    status: parseStatus(body.status),
    planTitle,
    workType,
    processStep,
    scopeSummary,
    revisionReason,
    referenceDrawingNo,
    referenceSpec,
    notes,
    checkpoints: checkpointsInput.map((item, index) => normalizeCheckpoint(item, index)),
  };
}
