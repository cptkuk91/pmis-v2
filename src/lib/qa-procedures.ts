export const QA_PROCEDURE_DOCUMENT_TYPE_VALUES = ["procedure", "template"] as const;
export type QaProcedureDocumentType = (typeof QA_PROCEDURE_DOCUMENT_TYPE_VALUES)[number];

export const QA_PROCEDURE_DOCUMENT_TYPE_LABELS: Record<QaProcedureDocumentType, string> = {
  procedure: "절차서",
  template: "템플릿",
};

export const QA_PROCEDURE_SCOPE_TYPE_VALUES = ["common", "site_specific", "process_specific"] as const;
export type QaProcedureScopeType = (typeof QA_PROCEDURE_SCOPE_TYPE_VALUES)[number];

export const QA_PROCEDURE_SCOPE_TYPE_LABELS: Record<QaProcedureScopeType, string> = {
  common: "공통",
  site_specific: "현장별",
  process_specific: "공정별",
};

export const QA_PROCEDURE_STATUS_VALUES = ["active", "retired"] as const;
export type QaProcedureStatus = (typeof QA_PROCEDURE_STATUS_VALUES)[number];

export const QA_PROCEDURE_STATUS_LABELS: Record<QaProcedureStatus, string> = {
  active: "운영중",
  retired: "폐기",
};

export const QA_PROCEDURE_REFERENCE_TARGET_VALUES = ["qap", "audit"] as const;
export type QaProcedureReferenceTarget = (typeof QA_PROCEDURE_REFERENCE_TARGET_VALUES)[number];

export const QA_PROCEDURE_REFERENCE_TARGET_LABELS: Record<QaProcedureReferenceTarget, string> = {
  qap: "QAP 참조",
  audit: "내부 심사 참조",
};

export function isQaProcedureDocumentType(value: string): value is QaProcedureDocumentType {
  return QA_PROCEDURE_DOCUMENT_TYPE_VALUES.includes(value as QaProcedureDocumentType);
}

export function isQaProcedureScopeType(value: string): value is QaProcedureScopeType {
  return QA_PROCEDURE_SCOPE_TYPE_VALUES.includes(value as QaProcedureScopeType);
}

export function isQaProcedureStatus(value: string): value is QaProcedureStatus {
  return QA_PROCEDURE_STATUS_VALUES.includes(value as QaProcedureStatus);
}

export function isQaProcedureReferenceTarget(value: string): value is QaProcedureReferenceTarget {
  return QA_PROCEDURE_REFERENCE_TARGET_VALUES.includes(value as QaProcedureReferenceTarget);
}
