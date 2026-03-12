import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QA_KPI_CYCLE_VALUES,
  QA_KPI_SOURCE_METRIC_VALUES,
  QA_KPI_TARGET_DIRECTION_VALUES,
  isQaKpiCycle,
  isQaKpiSourceMetric,
  isQaKpiTargetDirection,
  type QaKpiCycle,
  type QaKpiSourceMetric,
  type QaKpiTargetDirection,
} from "@/lib/qa-kpi";

export type QaKpiDefinitionPayload = {
  metricCode: string;
  metricName: string;
  sourceMetric: QaKpiSourceMetric;
  measurementCycle: QaKpiCycle;
  unit: string;
  targetDirection: QaKpiTargetDirection;
  targetValue: number;
  warningThreshold: number | null;
  linkedPolicyGoalId: string;
  linkedPolicyGoalYear: number | null;
  linkedPolicyGoalTitle: string;
  linkedPolicyGoalGoalId: string;
  linkedPolicyGoalMetricName: string;
  ownerName: string;
  ownerMemberId: string;
  description: string;
  isActive: boolean;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function parseMetricCode(value: unknown) {
  const metricCode = normalizeText(value).toUpperCase();
  if (!metricCode) {
    throw VALIDATION_ERROR("KPI 코드는 필수입니다.");
  }
  if (!/^[A-Z0-9_-]{2,40}$/.test(metricCode)) {
    throw VALIDATION_ERROR("KPI 코드는 영문/숫자/하이픈/언더스코어 2~40자여야 합니다.");
  }
  return metricCode;
}

function parseSourceMetric(value: unknown): QaKpiSourceMetric {
  const raw = normalizeText(value);
  if (!isQaKpiSourceMetric(raw)) {
    throw VALIDATION_ERROR(`집계 지표는 ${QA_KPI_SOURCE_METRIC_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseCycle(value: unknown): QaKpiCycle {
  const raw = normalizeText(value);
  if (!isQaKpiCycle(raw)) {
    throw VALIDATION_ERROR(`집계 주기는 ${QA_KPI_CYCLE_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseTargetDirection(value: unknown): QaKpiTargetDirection {
  const raw = normalizeText(value);
  if (!isQaKpiTargetDirection(raw)) {
    throw VALIDATION_ERROR(`목표 방향은 ${QA_KPI_TARGET_DIRECTION_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseNumber(value: unknown, fieldName: string, required = false) {
  const raw = normalizeText(value);
  if (!raw) {
    if (required) {
      throw VALIDATION_ERROR(`${fieldName}은(는) 필수입니다.`);
    }
    return null;
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1000000) {
    throw VALIDATION_ERROR(`${fieldName} 값이 올바르지 않습니다.`);
  }
  return Number(numeric.toFixed(2));
}

function parseOptionalYear(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw VALIDATION_ERROR("연결 정책 목표 연도가 올바르지 않습니다.");
  }
  return year;
}

export function normalizeQaKpiDefinitionPayload(body: Record<string, unknown>): QaKpiDefinitionPayload {
  const metricName = normalizeText(body.metricName);
  const unit = normalizeText(body.unit);
  const linkedPolicyGoalId = normalizeText(body.linkedPolicyGoalId);
  const linkedPolicyGoalTitle = normalizeText(body.linkedPolicyGoalTitle);
  const linkedPolicyGoalGoalId = normalizeText(body.linkedPolicyGoalGoalId);
  const linkedPolicyGoalMetricName = normalizeText(body.linkedPolicyGoalMetricName);
  const ownerName = normalizeText(body.ownerName);
  const ownerMemberId = normalizeText(body.ownerMemberId);
  const description = normalizeText(body.description);

  if (!metricName) {
    throw VALIDATION_ERROR("KPI 명은 필수입니다.");
  }
  if (!unit) {
    throw VALIDATION_ERROR("단위는 필수입니다.");
  }

  if (ownerMemberId && !mongoose.Types.ObjectId.isValid(ownerMemberId)) {
    throw VALIDATION_ERROR("담당자 식별자 형식이 올바르지 않습니다.");
  }
  if (linkedPolicyGoalId && !mongoose.Types.ObjectId.isValid(linkedPolicyGoalId)) {
    throw VALIDATION_ERROR("연결 정책 목표 식별자 형식이 올바르지 않습니다.");
  }

  assertNoUnsafeHtml(metricName, "KPI 명");
  assertNoUnsafeHtml(unit, "단위");
  assertNoUnsafeHtml(linkedPolicyGoalTitle, "연결 정책 목표");
  assertNoUnsafeHtml(linkedPolicyGoalGoalId, "연결 목표 항목 ID");
  assertNoUnsafeHtml(linkedPolicyGoalMetricName, "연결 정책 목표 지표명");
  assertNoUnsafeHtml(ownerName, "담당자");
  assertNoUnsafeHtml(description, "설명");

  return {
    metricCode: parseMetricCode(body.metricCode),
    metricName,
    sourceMetric: parseSourceMetric(body.sourceMetric),
    measurementCycle: parseCycle(body.measurementCycle),
    unit,
    targetDirection: parseTargetDirection(body.targetDirection),
    targetValue: parseNumber(body.targetValue, "목표값", true) ?? 0,
    warningThreshold: parseNumber(body.warningThreshold, "경고 기준"),
    linkedPolicyGoalId,
    linkedPolicyGoalYear: parseOptionalYear(body.linkedPolicyGoalYear),
    linkedPolicyGoalTitle,
    linkedPolicyGoalGoalId,
    linkedPolicyGoalMetricName,
    ownerName,
    ownerMemberId,
    description,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
}
