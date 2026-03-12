export const QA_ASSURANCE_PLAN_STATUS_VALUES = ["draft", "in_review", "approved", "archived"] as const;
export type QaAssurancePlanStatus = (typeof QA_ASSURANCE_PLAN_STATUS_VALUES)[number];

export const QA_ASSURANCE_PLAN_STATUS_LABELS: Record<QaAssurancePlanStatus, string> = {
  draft: "임시저장",
  in_review: "검토중",
  approved: "승인",
  archived: "보관",
};

export const QA_ASSURANCE_CHECKPOINT_STATUS_VALUES = ["planned", "in_progress", "completed"] as const;
export type QaAssuranceCheckpointStatus = (typeof QA_ASSURANCE_CHECKPOINT_STATUS_VALUES)[number];

export const QA_ASSURANCE_CHECKPOINT_STATUS_LABELS: Record<QaAssuranceCheckpointStatus, string> = {
  planned: "예정",
  in_progress: "진행중",
  completed: "완료",
};

export function isQaAssurancePlanStatus(value: string): value is QaAssurancePlanStatus {
  return QA_ASSURANCE_PLAN_STATUS_VALUES.includes(value as QaAssurancePlanStatus);
}

export function isQaAssuranceCheckpointStatus(value: string): value is QaAssuranceCheckpointStatus {
  return QA_ASSURANCE_CHECKPOINT_STATUS_VALUES.includes(value as QaAssuranceCheckpointStatus);
}
