import type { QaMeasurementCycle } from "@/lib/qa-policy-goals";

export const QA_KPI_SOURCE_METRIC_VALUES = [
  "audit_completion_rate",
  "audit_nonconformity_count",
  "capa_overdue_count",
  "partner_high_risk_count",
  "partner_follow_up_pending_count",
  "partner_average_score",
] as const;
export type QaKpiSourceMetric = (typeof QA_KPI_SOURCE_METRIC_VALUES)[number];

export const QA_KPI_SOURCE_METRIC_LABELS: Record<QaKpiSourceMetric, string> = {
  audit_completion_rate: "심사 완료율",
  audit_nonconformity_count: "부적합 건수",
  capa_overdue_count: "기한 경과 CAPA",
  partner_high_risk_count: "고위험 협력사 평가 건수",
  partner_follow_up_pending_count: "후속조치 대기 협력사 평가 건수",
  partner_average_score: "협력사 평균 점수",
};

export const QA_KPI_TARGET_DIRECTION_VALUES = ["at_least", "at_most"] as const;
export type QaKpiTargetDirection = (typeof QA_KPI_TARGET_DIRECTION_VALUES)[number];

export const QA_KPI_TARGET_DIRECTION_LABELS: Record<QaKpiTargetDirection, string> = {
  at_least: "이상 유지",
  at_most: "이하 유지",
};

export const QA_KPI_CYCLE_VALUES = ["monthly", "quarterly", "yearly"] as const;
export type QaKpiCycle = (typeof QA_KPI_CYCLE_VALUES)[number];

export const QA_KPI_CYCLE_LABELS: Record<QaKpiCycle, string> = {
  monthly: "월간",
  quarterly: "분기",
  yearly: "연간",
};

export function isQaKpiSourceMetric(value: string): value is QaKpiSourceMetric {
  return QA_KPI_SOURCE_METRIC_VALUES.includes(value as QaKpiSourceMetric);
}

export function isQaKpiTargetDirection(value: string): value is QaKpiTargetDirection {
  return QA_KPI_TARGET_DIRECTION_VALUES.includes(value as QaKpiTargetDirection);
}

export function isQaKpiCycle(value: string): value is QaKpiCycle {
  return QA_KPI_CYCLE_VALUES.includes(value as QaKpiCycle);
}

export function getDefaultQaKpiDirection(sourceMetric: QaKpiSourceMetric): QaKpiTargetDirection {
  if (sourceMetric === "audit_completion_rate" || sourceMetric === "partner_average_score") {
    return "at_least";
  }
  return "at_most";
}

export function getDefaultQaKpiUnit(sourceMetric: QaKpiSourceMetric) {
  if (sourceMetric === "audit_completion_rate" || sourceMetric === "partner_average_score") {
    return "%";
  }
  return "건";
}

export function mapPolicyGoalCycleToQaKpiCycle(cycle: QaMeasurementCycle): QaKpiCycle {
  if (cycle === "quarterly") {
    return "quarterly";
  }
  if (cycle === "yearly") {
    return "yearly";
  }
  return "monthly";
}

export function calculateQaKpiAchievementRate(
  actualValue: number,
  targetValue: number,
  targetDirection: QaKpiTargetDirection,
) {
  if (targetValue <= 0) {
    return 100;
  }

  if (targetDirection === "at_least") {
    return Number(((actualValue / targetValue) * 100).toFixed(1));
  }

  if (actualValue <= targetValue) {
    return 100;
  }

  return Number(((targetValue / actualValue) * 100).toFixed(1));
}

export function isQaKpiAlert(
  actualValue: number,
  thresholdValue: number,
  targetDirection: QaKpiTargetDirection,
) {
  if (thresholdValue < 0) {
    return false;
  }

  if (targetDirection === "at_least") {
    return actualValue < thresholdValue;
  }

  return actualValue > thresholdValue;
}
