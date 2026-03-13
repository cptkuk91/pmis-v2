import {
  QC_ATTACHMENT_CATEGORY_LABELS,
  QC_ATTACHMENT_CATEGORY_VALUES,
  type QcAttachmentCategory,
} from "@/lib/qc-core";

export const QC_PROCESS_INSPECTION_STATUS_VALUES = [
  "scheduled",
  "requested",
  "in_progress",
  "corrective_action_required",
  "corrected",
  "approved",
] as const;
export type QcProcessInspectionStatus = (typeof QC_PROCESS_INSPECTION_STATUS_VALUES)[number];

export const QC_PROCESS_INSPECTION_STATUS_LABELS: Record<QcProcessInspectionStatus, string> = {
  scheduled: "검사 예정",
  requested: "검사 요청",
  in_progress: "검사 진행",
  corrective_action_required: "시정조치 필요",
  corrected: "조치 완료",
  approved: "최종 승인",
};

export const QC_PROCESS_INSPECTION_RESULT_VALUES = ["pending", "pass", "fail", "reinspection"] as const;
export type QcProcessInspectionResult = (typeof QC_PROCESS_INSPECTION_RESULT_VALUES)[number];

export const QC_PROCESS_INSPECTION_RESULT_LABELS: Record<QcProcessInspectionResult, string> = {
  pending: "대기",
  pass: "합격",
  fail: "불합격",
  reinspection: "재검",
};

export const QC_PROCESS_INSPECTION_CHECK_STATUS_VALUES = ["pending", "pass", "fail", "na"] as const;
export type QcProcessInspectionCheckStatus = (typeof QC_PROCESS_INSPECTION_CHECK_STATUS_VALUES)[number];

export const QC_PROCESS_INSPECTION_CHECK_STATUS_LABELS: Record<QcProcessInspectionCheckStatus, string> = {
  pending: "미확인",
  pass: "적합",
  fail: "부적합",
  na: "해당 없음",
};

export const QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_VALUES = [
  "none",
  "requested",
  "in_progress",
  "completed",
] as const;
export type QcProcessInspectionCorrectiveActionStatus =
  (typeof QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_VALUES)[number];

export const QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_LABELS: Record<
  QcProcessInspectionCorrectiveActionStatus,
  string
> = {
  none: "없음",
  requested: "조치 요청",
  in_progress: "조치 진행",
  completed: "조치 완료",
};

export const QC_PROCESS_INSPECTION_ISSUE_STATUS_VALUES = ["none", "recommended", "linked"] as const;
export type QcProcessInspectionIssueStatus = (typeof QC_PROCESS_INSPECTION_ISSUE_STATUS_VALUES)[number];

export const QC_PROCESS_INSPECTION_ISSUE_STATUS_LABELS: Record<QcProcessInspectionIssueStatus, string> = {
  none: "없음",
  recommended: "이슈 검토",
  linked: "이슈 연결",
};

export const QC_PROCESS_INSPECTION_HISTORY_ACTION_VALUES = [
  "created",
  "updated",
  "inspection_started",
  "corrective_action_requested",
  "corrective_action_completed",
  "approved",
] as const;
export type QcProcessInspectionHistoryAction = (typeof QC_PROCESS_INSPECTION_HISTORY_ACTION_VALUES)[number];

export const QC_PROCESS_INSPECTION_HISTORY_ACTION_LABELS: Record<QcProcessInspectionHistoryAction, string> = {
  created: "초기 등록",
  updated: "정보 수정",
  inspection_started: "검사 진행",
  corrective_action_requested: "시정조치 요청",
  corrective_action_completed: "시정조치 완료",
  approved: "최종 승인",
};

export const QC_PROCESS_INSPECTION_SORT_VALUES = [
  "planned_date_desc",
  "planned_date_asc",
  "work_type_asc",
  "location_asc",
  "updated_desc",
] as const;
export type QcProcessInspectionSort = (typeof QC_PROCESS_INSPECTION_SORT_VALUES)[number];

export const QC_PROCESS_INSPECTION_SORT_LABELS: Record<QcProcessInspectionSort, string> = {
  planned_date_desc: "예정일 최신순",
  planned_date_asc: "예정일 오래된순",
  work_type_asc: "공종순",
  location_asc: "위치순",
  updated_desc: "최근 수정순",
};

export type QcProcessInspectionAttachment = {
  fileAssetId: string;
  fileName: string;
  fileUrl?: string;
  category: QcAttachmentCategory;
  sortOrder: number;
};

export type QcProcessInspectionChecklistItem = {
  itemId: string;
  label: string;
  status: QcProcessInspectionCheckStatus;
  note: string;
};

export type QcProcessInspectionHistoryEntry = {
  actionType: QcProcessInspectionHistoryAction;
  status: QcProcessInspectionStatus;
  correctiveActionStatus: QcProcessInspectionCorrectiveActionStatus;
  note: string;
  actorName: string;
  actionDate: string;
};

export const QC_PROCESS_INSPECTION_STATUS_OPTIONS = QC_PROCESS_INSPECTION_STATUS_VALUES.map((value) => ({
  value,
  label: QC_PROCESS_INSPECTION_STATUS_LABELS[value],
}));

export const QC_PROCESS_INSPECTION_RESULT_OPTIONS = QC_PROCESS_INSPECTION_RESULT_VALUES.map((value) => ({
  value,
  label: QC_PROCESS_INSPECTION_RESULT_LABELS[value],
}));

export const QC_PROCESS_INSPECTION_CHECK_STATUS_OPTIONS = QC_PROCESS_INSPECTION_CHECK_STATUS_VALUES.map((value) => ({
  value,
  label: QC_PROCESS_INSPECTION_CHECK_STATUS_LABELS[value],
}));

export const QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_OPTIONS =
  QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_VALUES.map((value) => ({
    value,
    label: QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_LABELS[value],
  }));

export const QC_PROCESS_INSPECTION_ISSUE_STATUS_OPTIONS = QC_PROCESS_INSPECTION_ISSUE_STATUS_VALUES.map((value) => ({
  value,
  label: QC_PROCESS_INSPECTION_ISSUE_STATUS_LABELS[value],
}));

export const QC_PROCESS_INSPECTION_ATTACHMENT_CATEGORY_OPTIONS = QC_ATTACHMENT_CATEGORY_VALUES.map((value) => ({
  value,
  label: QC_ATTACHMENT_CATEGORY_LABELS[value],
}));

export function isQcProcessInspectionStatus(value: string): value is QcProcessInspectionStatus {
  return QC_PROCESS_INSPECTION_STATUS_VALUES.includes(value as QcProcessInspectionStatus);
}

export function isQcProcessInspectionResult(value: string): value is QcProcessInspectionResult {
  return QC_PROCESS_INSPECTION_RESULT_VALUES.includes(value as QcProcessInspectionResult);
}

export function isQcProcessInspectionCheckStatus(value: string): value is QcProcessInspectionCheckStatus {
  return QC_PROCESS_INSPECTION_CHECK_STATUS_VALUES.includes(value as QcProcessInspectionCheckStatus);
}

export function isQcProcessInspectionCorrectiveActionStatus(
  value: string,
): value is QcProcessInspectionCorrectiveActionStatus {
  return QC_PROCESS_INSPECTION_CORRECTIVE_ACTION_STATUS_VALUES.includes(
    value as QcProcessInspectionCorrectiveActionStatus,
  );
}

export function isQcProcessInspectionIssueStatus(value: string): value is QcProcessInspectionIssueStatus {
  return QC_PROCESS_INSPECTION_ISSUE_STATUS_VALUES.includes(value as QcProcessInspectionIssueStatus);
}

export function isQcProcessInspectionSort(value: string): value is QcProcessInspectionSort {
  return QC_PROCESS_INSPECTION_SORT_VALUES.includes(value as QcProcessInspectionSort);
}

export function getQcProcessInspectionSort(sort: QcProcessInspectionSort): Record<string, 1 | -1> {
  switch (sort) {
    case "planned_date_asc":
      return { plannedInspectionDate: 1, createdAt: 1 };
    case "work_type_asc":
      return { workType: 1, plannedInspectionDate: -1 };
    case "location_asc":
      return { location: 1, plannedInspectionDate: -1 };
    case "updated_desc":
      return { updatedAt: -1, plannedInspectionDate: -1 };
    case "planned_date_desc":
    default:
      return { plannedInspectionDate: -1, createdAt: -1 };
  }
}
