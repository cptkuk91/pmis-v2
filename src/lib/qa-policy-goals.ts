export const QA_POLICY_GOAL_STATUS_VALUES = ["draft", "active", "archived"] as const;
export type QaPolicyGoalStatus = (typeof QA_POLICY_GOAL_STATUS_VALUES)[number];

export const QA_POLICY_GOAL_STATUS_LABELS: Record<QaPolicyGoalStatus, string> = {
  draft: "임시저장",
  active: "운영중",
  archived: "보관",
};

export const QA_MEASUREMENT_CYCLE_VALUES = ["monthly", "quarterly", "yearly", "once"] as const;
export type QaMeasurementCycle = (typeof QA_MEASUREMENT_CYCLE_VALUES)[number];

export const QA_MEASUREMENT_CYCLE_LABELS: Record<QaMeasurementCycle, string> = {
  monthly: "월간",
  quarterly: "분기",
  yearly: "연간",
  once: "일회성",
};

export function isQaPolicyGoalStatus(value: string): value is QaPolicyGoalStatus {
  return QA_POLICY_GOAL_STATUS_VALUES.includes(value as QaPolicyGoalStatus);
}

export function isQaMeasurementCycle(value: string): value is QaMeasurementCycle {
  return QA_MEASUREMENT_CYCLE_VALUES.includes(value as QaMeasurementCycle);
}
