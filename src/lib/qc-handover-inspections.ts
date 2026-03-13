import {
  QC_ATTACHMENT_CATEGORY_LABELS,
  QC_ATTACHMENT_CATEGORY_VALUES,
  type QcAttachmentCategory,
} from "@/lib/qc-core";

export const QC_HANDOVER_INSPECTION_TYPE_VALUES = ["acceptance", "completion"] as const;
export type QcHandoverInspectionType = (typeof QC_HANDOVER_INSPECTION_TYPE_VALUES)[number];

export const QC_HANDOVER_INSPECTION_TYPE_LABELS: Record<QcHandoverInspectionType, string> = {
  acceptance: "인수 검사",
  completion: "준공 검사",
};

export const QC_HANDOVER_AREA_TYPE_VALUES = ["space", "unit", "zone", "common"] as const;
export type QcHandoverAreaType = (typeof QC_HANDOVER_AREA_TYPE_VALUES)[number];

export const QC_HANDOVER_AREA_TYPE_LABELS: Record<QcHandoverAreaType, string> = {
  space: "공간",
  unit: "세대",
  zone: "구역",
  common: "공용부",
};

export const QC_HANDOVER_STATUS_VALUES = [
  "scheduled",
  "in_progress",
  "follow_up",
  "approval_requested",
  "approved",
  "closed",
] as const;
export type QcHandoverStatus = (typeof QC_HANDOVER_STATUS_VALUES)[number];

export const QC_HANDOVER_STATUS_LABELS: Record<QcHandoverStatus, string> = {
  scheduled: "예정",
  in_progress: "검사중",
  follow_up: "보완중",
  approval_requested: "승인 요청",
  approved: "승인 완료",
  closed: "종결",
};

export const QC_HANDOVER_RESULT_VALUES = ["pending", "pass", "conditional", "fail"] as const;
export type QcHandoverResult = (typeof QC_HANDOVER_RESULT_VALUES)[number];

export const QC_HANDOVER_RESULT_LABELS: Record<QcHandoverResult, string> = {
  pending: "대기",
  pass: "합격",
  conditional: "조건부 합격",
  fail: "불합격",
};

export const QC_HANDOVER_CHECK_STATUS_VALUES = ["pending", "pass", "conditional", "fail", "na"] as const;
export type QcHandoverCheckStatus = (typeof QC_HANDOVER_CHECK_STATUS_VALUES)[number];

export const QC_HANDOVER_CHECK_STATUS_LABELS: Record<QcHandoverCheckStatus, string> = {
  pending: "미확인",
  pass: "적합",
  conditional: "조건부",
  fail: "부적합",
  na: "해당 없음",
};

export const QC_HANDOVER_FINDING_STATUS_VALUES = [
  "none",
  "requested",
  "in_progress",
  "completed",
  "verified",
] as const;
export type QcHandoverFindingStatus = (typeof QC_HANDOVER_FINDING_STATUS_VALUES)[number];

export const QC_HANDOVER_FINDING_STATUS_LABELS: Record<QcHandoverFindingStatus, string> = {
  none: "없음",
  requested: "보완 요청",
  in_progress: "보완 진행",
  completed: "보완 완료",
  verified: "확인 완료",
};

export const QC_HANDOVER_APPROVAL_STATUS_VALUES = ["none", "requested", "approved", "rejected"] as const;
export type QcHandoverApprovalStatus = (typeof QC_HANDOVER_APPROVAL_STATUS_VALUES)[number];

export const QC_HANDOVER_APPROVAL_STATUS_LABELS: Record<QcHandoverApprovalStatus, string> = {
  none: "미요청",
  requested: "승인 요청",
  approved: "승인 완료",
  rejected: "반려",
};

export const QC_HANDOVER_HISTORY_ACTION_VALUES = [
  "created",
  "updated",
  "inspection_started",
  "finding_requested",
  "finding_completed",
  "approval_requested",
  "approved",
  "closed",
] as const;
export type QcHandoverHistoryAction = (typeof QC_HANDOVER_HISTORY_ACTION_VALUES)[number];

export const QC_HANDOVER_HISTORY_ACTION_LABELS: Record<QcHandoverHistoryAction, string> = {
  created: "초기 등록",
  updated: "정보 수정",
  inspection_started: "검사 진행",
  finding_requested: "보완 요청",
  finding_completed: "보완 완료",
  approval_requested: "승인 요청",
  approved: "승인 완료",
  closed: "종결",
};

export const QC_HANDOVER_SORT_VALUES = [
  "planned_date_desc",
  "planned_date_asc",
  "open_findings_desc",
  "updated_desc",
  "work_type_asc",
] as const;
export type QcHandoverSort = (typeof QC_HANDOVER_SORT_VALUES)[number];

export const QC_HANDOVER_SORT_LABELS: Record<QcHandoverSort, string> = {
  planned_date_desc: "예정일 최신순",
  planned_date_asc: "예정일 오래된순",
  open_findings_desc: "미조치 많은순",
  updated_desc: "최근 수정순",
  work_type_asc: "공종순",
};

export type QcHandoverInspectionAttachment = {
  fileAssetId: string;
  fileName: string;
  fileUrl?: string;
  category: QcAttachmentCategory;
  sortOrder: number;
};

export type QcHandoverInspectionChecklistItem = {
  itemId: string;
  sectionTitle: string;
  checkpointTitle: string;
  spaceLabel: string;
  status: QcHandoverCheckStatus;
  note: string;
  findingTitle: string;
  correctiveRequest: string;
  correctiveDueDate?: string | null;
  findingStatus: QcHandoverFindingStatus;
  completionNote: string;
};

export type QcHandoverInspectionHistoryEntry = {
  actionType: QcHandoverHistoryAction;
  status: QcHandoverStatus;
  approvalStatus: QcHandoverApprovalStatus;
  note: string;
  actorName: string;
  actionDate: string;
};

export const QC_HANDOVER_INSPECTION_TYPE_OPTIONS = QC_HANDOVER_INSPECTION_TYPE_VALUES.map((value) => ({
  value,
  label: QC_HANDOVER_INSPECTION_TYPE_LABELS[value],
}));

export const QC_HANDOVER_AREA_TYPE_OPTIONS = QC_HANDOVER_AREA_TYPE_VALUES.map((value) => ({
  value,
  label: QC_HANDOVER_AREA_TYPE_LABELS[value],
}));

export const QC_HANDOVER_STATUS_OPTIONS = QC_HANDOVER_STATUS_VALUES.map((value) => ({
  value,
  label: QC_HANDOVER_STATUS_LABELS[value],
}));

export const QC_HANDOVER_RESULT_OPTIONS = QC_HANDOVER_RESULT_VALUES.map((value) => ({
  value,
  label: QC_HANDOVER_RESULT_LABELS[value],
}));

export const QC_HANDOVER_CHECK_STATUS_OPTIONS = QC_HANDOVER_CHECK_STATUS_VALUES.map((value) => ({
  value,
  label: QC_HANDOVER_CHECK_STATUS_LABELS[value],
}));

export const QC_HANDOVER_FINDING_STATUS_OPTIONS = QC_HANDOVER_FINDING_STATUS_VALUES.map((value) => ({
  value,
  label: QC_HANDOVER_FINDING_STATUS_LABELS[value],
}));

export const QC_HANDOVER_APPROVAL_STATUS_OPTIONS = QC_HANDOVER_APPROVAL_STATUS_VALUES.map((value) => ({
  value,
  label: QC_HANDOVER_APPROVAL_STATUS_LABELS[value],
}));

export const QC_HANDOVER_ATTACHMENT_CATEGORY_OPTIONS = QC_ATTACHMENT_CATEGORY_VALUES.map((value) => ({
  value,
  label: QC_ATTACHMENT_CATEGORY_LABELS[value],
}));

export function isQcHandoverInspectionType(value: string): value is QcHandoverInspectionType {
  return QC_HANDOVER_INSPECTION_TYPE_VALUES.includes(value as QcHandoverInspectionType);
}

export function isQcHandoverAreaType(value: string): value is QcHandoverAreaType {
  return QC_HANDOVER_AREA_TYPE_VALUES.includes(value as QcHandoverAreaType);
}

export function isQcHandoverStatus(value: string): value is QcHandoverStatus {
  return QC_HANDOVER_STATUS_VALUES.includes(value as QcHandoverStatus);
}

export function isQcHandoverResult(value: string): value is QcHandoverResult {
  return QC_HANDOVER_RESULT_VALUES.includes(value as QcHandoverResult);
}

export function isQcHandoverCheckStatus(value: string): value is QcHandoverCheckStatus {
  return QC_HANDOVER_CHECK_STATUS_VALUES.includes(value as QcHandoverCheckStatus);
}

export function isQcHandoverFindingStatus(value: string): value is QcHandoverFindingStatus {
  return QC_HANDOVER_FINDING_STATUS_VALUES.includes(value as QcHandoverFindingStatus);
}

export function isQcHandoverApprovalStatus(value: string): value is QcHandoverApprovalStatus {
  return QC_HANDOVER_APPROVAL_STATUS_VALUES.includes(value as QcHandoverApprovalStatus);
}

export function isQcHandoverSort(value: string): value is QcHandoverSort {
  return QC_HANDOVER_SORT_VALUES.includes(value as QcHandoverSort);
}

export function getQcHandoverSort(sort: QcHandoverSort): Record<string, 1 | -1> {
  switch (sort) {
    case "planned_date_asc":
      return { plannedInspectionDate: 1, createdAt: 1 };
    case "open_findings_desc":
      return { openFindingCount: -1, plannedInspectionDate: -1 };
    case "updated_desc":
      return { updatedAt: -1, plannedInspectionDate: -1 };
    case "work_type_asc":
      return { workType: 1, plannedInspectionDate: -1 };
    case "planned_date_desc":
    default:
      return { plannedInspectionDate: -1, createdAt: -1 };
  }
}

export function isQcHandoverChecklistActionable(item: {
  status?: string;
  findingTitle?: string;
  correctiveRequest?: string;
  findingStatus?: string;
  completionNote?: string;
  correctiveDueDate?: Date | string | null;
}) {
  const findingTitle = String(item.findingTitle ?? "").trim();
  const correctiveRequest = String(item.correctiveRequest ?? "").trim();
  const completionNote = String(item.completionNote ?? "").trim();
  const findingStatus = String(item.findingStatus ?? "none").trim();
  return (
    item.status === "fail" ||
    item.status === "conditional" ||
    Boolean(findingTitle) ||
    Boolean(correctiveRequest) ||
    Boolean(completionNote) ||
    Boolean(item.correctiveDueDate) ||
    (findingStatus !== "none" && findingStatus !== "")
  );
}

export function getQcHandoverOpenFindingCount(
  items: Array<{
    status?: string;
    findingTitle?: string;
    correctiveRequest?: string;
    findingStatus?: string;
    completionNote?: string;
    correctiveDueDate?: Date | string | null;
  }>,
) {
  return items.reduce((count, item) => {
    if (!isQcHandoverChecklistActionable(item)) {
      return count;
    }
    const findingStatus = String(item.findingStatus ?? "none").trim();
    return findingStatus === "completed" || findingStatus === "verified" ? count : count + 1;
  }, 0);
}

export function getQcHandoverResult(
  items: Array<{
    status?: string;
  }>,
): QcHandoverResult {
  const statuses = items.map((item) => String(item.status ?? "pending").trim());
  if (statuses.some((status) => status === "fail")) {
    return "fail";
  }
  if (statuses.some((status) => status === "conditional")) {
    return "conditional";
  }
  if (statuses.some((status) => status === "pending")) {
    return "pending";
  }
  if (statuses.some((status) => status === "pass")) {
    return "pass";
  }
  return "pending";
}

export function validateQcHandoverLifecycle(input: {
  status: QcHandoverStatus;
  approvalStatus: QcHandoverApprovalStatus;
  openFindingCount: number;
  approvedAt?: Date | null;
}) {
  if (input.openFindingCount > 0 && (input.status === "approved" || input.status === "closed")) {
    throw new Error("미조치 지적사항이 남아 있으면 승인 또는 종결할 수 없습니다.");
  }

  if (input.status === "closed" && input.approvalStatus !== "approved") {
    throw new Error("종결 상태는 승인 완료 이후에만 설정할 수 있습니다.");
  }

  if (input.approvalStatus === "approved" && !input.approvedAt) {
    throw new Error("승인 완료 시 승인일이 필요합니다.");
  }
}
