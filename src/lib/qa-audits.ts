export const QA_AUDIT_TYPE_VALUES = ["regular", "special"] as const;
export type QaAuditType = (typeof QA_AUDIT_TYPE_VALUES)[number];

export const QA_AUDIT_TYPE_LABELS: Record<QaAuditType, string> = {
  regular: "정기 심사",
  special: "수시 심사",
};

export const QA_AUDIT_STATUS_VALUES = ["planned", "in_progress", "completed", "closed"] as const;
export type QaAuditStatus = (typeof QA_AUDIT_STATUS_VALUES)[number];

export const QA_AUDIT_STATUS_LABELS: Record<QaAuditStatus, string> = {
  planned: "예정",
  in_progress: "진행중",
  completed: "완료",
  closed: "종결",
};

export const QA_AUDIT_RESULT_VALUES = ["conformity", "nonconformity", "observation"] as const;
export type QaAuditResult = (typeof QA_AUDIT_RESULT_VALUES)[number];

export const QA_AUDIT_RESULT_LABELS: Record<QaAuditResult, string> = {
  conformity: "적합",
  nonconformity: "부적합",
  observation: "관찰",
};

export function isQaAuditType(value: string): value is QaAuditType {
  return QA_AUDIT_TYPE_VALUES.includes(value as QaAuditType);
}

export function isQaAuditStatus(value: string): value is QaAuditStatus {
  return QA_AUDIT_STATUS_VALUES.includes(value as QaAuditStatus);
}

export function isQaAuditResult(value: string): value is QaAuditResult {
  return QA_AUDIT_RESULT_VALUES.includes(value as QaAuditResult);
}
