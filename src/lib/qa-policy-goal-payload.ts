import { VALIDATION_ERROR } from "@/lib/api-error";
import { assertNoUnsafeHtml } from "@/lib/request-security";
import {
  QA_MEASUREMENT_CYCLE_VALUES,
  QA_POLICY_GOAL_STATUS_VALUES,
  isQaMeasurementCycle,
  isQaPolicyGoalStatus,
  type QaMeasurementCycle,
  type QaPolicyGoalStatus,
} from "@/lib/qa-policy-goals";

export type QaPolicyGoalPayload = {
  year: number;
  status: QaPolicyGoalStatus;
  policyTitle: string;
  policyStatement: string;
  effectiveDate: Date | null;
  revisionNo: number;
  goals: Array<{
    goalId: string;
    title: string;
    metricName: string;
    unit: string;
    targetValue: string;
    measurementCycle: QaMeasurementCycle;
    ownerName: string;
    ownerMemberId: string;
    note: string;
  }>;
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeGoalId(value: unknown, index: number): string {
  const candidate = normalizeText(value);
  if (candidate) {
    return candidate;
  }
  return `goal-${Date.now()}-${index + 1}`;
}

function parseYear(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 2000 || numeric > 2100) {
    throw VALIDATION_ERROR("적용연도는 2000~2100 범위의 정수여야 합니다.");
  }
  return numeric;
}

function parseRevisionNo(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99) {
    throw VALIDATION_ERROR("개정번호는 1~99 범위의 정수여야 합니다.");
  }
  return numeric;
}

function parseEffectiveDate(value: unknown): Date | null {
  const raw = normalizeText(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR("시행일 형식이 올바르지 않습니다.");
  }
  return parsed;
}

function parseStatus(value: unknown): QaPolicyGoalStatus {
  const raw = normalizeText(value) || "draft";
  if (!isQaPolicyGoalStatus(raw)) {
    throw VALIDATION_ERROR(`상태는 ${QA_POLICY_GOAL_STATUS_VALUES.join(", ")} 중 하나여야 합니다.`);
  }
  return raw;
}

function parseMeasurementCycle(value: unknown): QaMeasurementCycle {
  const raw = normalizeText(value) || "monthly";
  if (!isQaMeasurementCycle(raw)) {
    throw VALIDATION_ERROR(
      `측정주기는 ${QA_MEASUREMENT_CYCLE_VALUES.join(", ")} 중 하나여야 합니다.`,
    );
  }
  return raw;
}

function normalizeGoalItem(value: unknown, index: number) {
  const goal = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const title = normalizeText(goal.title);
  const metricName = normalizeText(goal.metricName);
  const targetValue = normalizeText(goal.targetValue);
  const unit = normalizeText(goal.unit);
  const ownerName = normalizeText(goal.ownerName);
  const ownerMemberId = normalizeText(goal.ownerMemberId);
  const note = normalizeText(goal.note);

  if (!title) {
    throw VALIDATION_ERROR(`목표 항목 ${index + 1}의 목표명은 필수입니다.`);
  }
  if (!metricName) {
    throw VALIDATION_ERROR(`목표 항목 ${index + 1}의 지표명은 필수입니다.`);
  }
  if (!targetValue) {
    throw VALIDATION_ERROR(`목표 항목 ${index + 1}의 목표치는 필수입니다.`);
  }

  assertNoUnsafeHtml(title, `목표 항목 ${index + 1} 목표명`);
  assertNoUnsafeHtml(metricName, `목표 항목 ${index + 1} 지표명`);
  assertNoUnsafeHtml(targetValue, `목표 항목 ${index + 1} 목표치`);
  assertNoUnsafeHtml(unit, `목표 항목 ${index + 1} 단위`);
  assertNoUnsafeHtml(ownerName, `목표 항목 ${index + 1} 담당자`);
  assertNoUnsafeHtml(note, `목표 항목 ${index + 1} 비고`);

  return {
    goalId: normalizeGoalId(goal.goalId, index),
    title,
    metricName,
    unit,
    targetValue,
    measurementCycle: parseMeasurementCycle(goal.measurementCycle),
    ownerName,
    ownerMemberId,
    note,
  };
}

export function normalizeQaPolicyGoalPayload(body: Record<string, unknown>): QaPolicyGoalPayload {
  const year = parseYear(body.year);
  const policyTitle = normalizeText(body.policyTitle);
  const policyStatement = normalizeText(body.policyStatement);
  const goalsInput = Array.isArray(body.goals) ? body.goals : [];

  if (!policyTitle) {
    throw VALIDATION_ERROR("품질방침 제목은 필수입니다.");
  }
  if (!policyStatement) {
    throw VALIDATION_ERROR("품질방침 내용은 필수입니다.");
  }
  if (!goalsInput.length) {
    throw VALIDATION_ERROR("목표 항목은 최소 1개 이상이어야 합니다.");
  }

  assertNoUnsafeHtml(policyTitle, "품질방침 제목");
  assertNoUnsafeHtml(policyStatement, "품질방침 내용");

  return {
    year,
    status: parseStatus(body.status),
    policyTitle,
    policyStatement,
    effectiveDate: parseEffectiveDate(body.effectiveDate),
    revisionNo: parseRevisionNo(body.revisionNo ?? 1),
    goals: goalsInput.map((goal, index) => normalizeGoalItem(goal, index)),
  };
}
