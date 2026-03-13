import type { QcAttachmentCategory } from "@/lib/qc-core";

export const QC_NONCONFORMANCE_OCCURRENCE_TYPE_VALUES = [
  "material_defect",
  "process_defect",
  "test_failure",
  "dimensional_issue",
  "documentation_issue",
  "other",
] as const;
export type QcNonconformanceOccurrenceType = (typeof QC_NONCONFORMANCE_OCCURRENCE_TYPE_VALUES)[number];

export const QC_NONCONFORMANCE_OCCURRENCE_TYPE_LABELS: Record<QcNonconformanceOccurrenceType, string> = {
  material_defect: "자재 부적합",
  process_defect: "시공 부적합",
  test_failure: "시험 부적합",
  dimensional_issue: "치수 이탈",
  documentation_issue: "기준서 불일치",
  other: "기타",
};

export const QC_NONCONFORMANCE_SOURCE_TYPE_VALUES = [
  "manual",
  "material_inspection",
  "process_inspection",
  "test_report",
] as const;
export type QcNonconformanceSourceType = (typeof QC_NONCONFORMANCE_SOURCE_TYPE_VALUES)[number];

export const QC_NONCONFORMANCE_SOURCE_TYPE_LABELS: Record<QcNonconformanceSourceType, string> = {
  manual: "직접 등록",
  material_inspection: "자재 검사",
  process_inspection: "공정 검사",
  test_report: "시험 성적서",
};

export const QC_NONCONFORMANCE_SEVERITY_VALUES = ["low", "medium", "high", "critical"] as const;
export type QcNonconformanceSeverity = (typeof QC_NONCONFORMANCE_SEVERITY_VALUES)[number];

export const QC_NONCONFORMANCE_SEVERITY_LABELS: Record<QcNonconformanceSeverity, string> = {
  low: "경미",
  medium: "보통",
  high: "중대",
  critical: "치명",
};

export const QC_NONCONFORMANCE_STATUS_VALUES = [
  "open",
  "analysis",
  "action_in_progress",
  "verification",
  "closed",
] as const;
export type QcNonconformanceStatus = (typeof QC_NONCONFORMANCE_STATUS_VALUES)[number];

export const QC_NONCONFORMANCE_STATUS_LABELS: Record<QcNonconformanceStatus, string> = {
  open: "등록",
  analysis: "원인분석",
  action_in_progress: "조치중",
  verification: "검증대기",
  closed: "종결",
};

export const QC_NONCONFORMANCE_STATUS_TRANSITIONS: Record<
  QcNonconformanceStatus,
  QcNonconformanceStatus[]
> = {
  open: ["analysis", "action_in_progress", "closed"],
  analysis: ["action_in_progress", "verification", "closed"],
  action_in_progress: ["analysis", "verification", "closed"],
  verification: ["action_in_progress", "closed"],
  closed: ["action_in_progress"],
};

export const QC_NONCONFORMANCE_VERIFICATION_RESULT_VALUES = ["pending", "pass", "fail"] as const;
export type QcNonconformanceVerificationResult = (typeof QC_NONCONFORMANCE_VERIFICATION_RESULT_VALUES)[number];

export const QC_NONCONFORMANCE_VERIFICATION_RESULT_LABELS: Record<
  QcNonconformanceVerificationResult,
  string
> = {
  pending: "검증 대기",
  pass: "적합",
  fail: "부적합",
};

export const QC_NONCONFORMANCE_HISTORY_ACTION_VALUES = [
  "created",
  "updated",
  "status_changed",
  "verification_completed",
  "reminder_sent",
  "closed",
] as const;
export type QcNonconformanceHistoryAction = (typeof QC_NONCONFORMANCE_HISTORY_ACTION_VALUES)[number];

export const QC_NONCONFORMANCE_HISTORY_ACTION_LABELS: Record<QcNonconformanceHistoryAction, string> = {
  created: "초기 등록",
  updated: "정보 수정",
  status_changed: "상태 변경",
  verification_completed: "검증 결과 반영",
  reminder_sent: "리마인드 기록",
  closed: "종결",
};

export const QC_NONCONFORMANCE_SORT_VALUES = [
  "due_asc",
  "due_desc",
  "created_desc",
  "severity_desc",
  "updated_desc",
] as const;
export type QcNonconformanceSort = (typeof QC_NONCONFORMANCE_SORT_VALUES)[number];

export const QC_NONCONFORMANCE_SORT_LABELS: Record<QcNonconformanceSort, string> = {
  due_asc: "기한 빠른순",
  due_desc: "기한 최신순",
  created_desc: "최근 등록순",
  severity_desc: "심각도 높은순",
  updated_desc: "최근 수정순",
};

export const QC_NONCONFORMANCE_ATTACHMENT_CATEGORY_OPTIONS: Array<{
  value: QcAttachmentCategory;
  label: string;
}> = [
  { value: "photo", label: "사진" },
  { value: "report", label: "보고서" },
  { value: "checksheet", label: "체크시트" },
  { value: "certificate", label: "성적서" },
  { value: "other", label: "기타" },
];

export const QC_NONCONFORMANCE_REMINDER_DAYS = 2;

export type QcNonconformanceAttachment = {
  fileAssetId: string;
  fileName: string;
  fileUrl?: string;
  category: QcAttachmentCategory;
  sortOrder: number;
};

export type QcNonconformanceHistoryEntry = {
  actionType: QcNonconformanceHistoryAction;
  status: QcNonconformanceStatus;
  verificationResult: QcNonconformanceVerificationResult;
  note: string;
  actorName: string;
  actionDate: string;
};

export function isQcNonconformanceOccurrenceType(value: string): value is QcNonconformanceOccurrenceType {
  return QC_NONCONFORMANCE_OCCURRENCE_TYPE_VALUES.includes(value as QcNonconformanceOccurrenceType);
}

export function isQcNonconformanceSourceType(value: string): value is QcNonconformanceSourceType {
  return QC_NONCONFORMANCE_SOURCE_TYPE_VALUES.includes(value as QcNonconformanceSourceType);
}

export function isQcNonconformanceSeverity(value: string): value is QcNonconformanceSeverity {
  return QC_NONCONFORMANCE_SEVERITY_VALUES.includes(value as QcNonconformanceSeverity);
}

export function isQcNonconformanceStatus(value: string): value is QcNonconformanceStatus {
  return QC_NONCONFORMANCE_STATUS_VALUES.includes(value as QcNonconformanceStatus);
}

export function isQcNonconformanceVerificationResult(
  value: string,
): value is QcNonconformanceVerificationResult {
  return QC_NONCONFORMANCE_VERIFICATION_RESULT_VALUES.includes(value as QcNonconformanceVerificationResult);
}

export function isQcNonconformanceSort(value: string): value is QcNonconformanceSort {
  return QC_NONCONFORMANCE_SORT_VALUES.includes(value as QcNonconformanceSort);
}

export function getQcNonconformanceSort(sort: QcNonconformanceSort): Record<string, 1 | -1> {
  switch (sort) {
    case "due_desc":
      return { dueDate: -1, createdAt: -1 };
    case "created_desc":
      return { createdAt: -1, dueDate: 1 };
    case "severity_desc":
      return { severityRank: -1, dueDate: 1, createdAt: -1 };
    case "updated_desc":
      return { updatedAt: -1, dueDate: 1 };
    case "due_asc":
    default:
      return { dueDate: 1, createdAt: -1 };
  }
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function isQcNonconformanceOverdue(input: {
  dueDate?: Date | string | null;
  status: QcNonconformanceStatus;
  referenceDate?: Date;
}) {
  if (input.status === "closed") {
    return false;
  }
  const dueDate = normalizeDate(input.dueDate);
  if (!dueDate) {
    return false;
  }
  const referenceDate = input.referenceDate ?? new Date();
  return dueDate.getTime() < referenceDate.getTime();
}

export function isQcNonconformanceDueSoon(input: {
  dueDate?: Date | string | null;
  status: QcNonconformanceStatus;
  referenceDate?: Date;
  leadDays?: number;
}) {
  if (input.status === "closed") {
    return false;
  }
  const dueDate = normalizeDate(input.dueDate);
  if (!dueDate) {
    return false;
  }
  const referenceDate = input.referenceDate ?? new Date();
  const leadDays = input.leadDays ?? QC_NONCONFORMANCE_REMINDER_DAYS;
  const boundary = new Date(referenceDate);
  boundary.setDate(boundary.getDate() + leadDays);
  return dueDate.getTime() >= referenceDate.getTime() && dueDate.getTime() <= boundary.getTime();
}

export function getQcNonconformanceSeverityRank(severity: QcNonconformanceSeverity) {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
    default:
      return 1;
  }
}
