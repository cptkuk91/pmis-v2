export type QcOption<T extends string = string> = {
  value: T;
  label: string;
};

export const QC_PERMISSION_ROLE_VALUES = ["viewer", "manager", "site_admin", "super_admin"] as const;
export type QcPermissionRole = (typeof QC_PERMISSION_ROLE_VALUES)[number];

export const QC_PERMISSION_ROLE_LABELS: Record<QcPermissionRole, string> = {
  viewer: "조회",
  manager: "등록/수정",
  site_admin: "현장 관리자",
  super_admin: "시스템 관리자",
};

export const QC_INSPECTION_STATUS_VALUES = [
  "draft",
  "scheduled",
  "in_progress",
  "completed",
  "approved",
  "reinspection",
] as const;
export type QcInspectionStatus = (typeof QC_INSPECTION_STATUS_VALUES)[number];

export const QC_INSPECTION_STATUS_LABELS: Record<QcInspectionStatus, string> = {
  draft: "임시저장",
  scheduled: "예정",
  in_progress: "진행중",
  completed: "완료",
  approved: "승인",
  reinspection: "재검",
};

export const QC_ATTACHMENT_CATEGORY_VALUES = ["photo", "checksheet", "report", "certificate", "other"] as const;
export type QcAttachmentCategory = (typeof QC_ATTACHMENT_CATEGORY_VALUES)[number];

export const QC_ATTACHMENT_CATEGORY_LABELS: Record<QcAttachmentCategory, string> = {
  photo: "사진",
  checksheet: "체크시트",
  report: "보고서",
  certificate: "성적서",
  other: "기타",
};

export const QC_NOTIFICATION_EVENT_VALUES = [
  "inspection_due",
  "inspection_failed",
  "ncr_overdue",
  "handover_pending",
] as const;
export type QcNotificationEvent = (typeof QC_NOTIFICATION_EVENT_VALUES)[number];

export const QC_NOTIFICATION_EVENT_LABELS: Record<QcNotificationEvent, string> = {
  inspection_due: "검사 예정 알림",
  inspection_failed: "불합격 검사 알림",
  ncr_overdue: "지연 NCR 알림",
  handover_pending: "준공 검사 미완료 알림",
};

function mapOptions<T extends string>(values: readonly T[], labels: Record<T, string>): QcOption<T>[] {
  return values.map((value) => ({
    value,
    label: labels[value],
  }));
}

export const QC_PERMISSION_ROLE_OPTIONS = mapOptions(QC_PERMISSION_ROLE_VALUES, QC_PERMISSION_ROLE_LABELS);
export const QC_INSPECTION_STATUS_OPTIONS = mapOptions(QC_INSPECTION_STATUS_VALUES, QC_INSPECTION_STATUS_LABELS);
export const QC_ATTACHMENT_CATEGORY_OPTIONS = mapOptions(
  QC_ATTACHMENT_CATEGORY_VALUES,
  QC_ATTACHMENT_CATEGORY_LABELS,
);
export const QC_NOTIFICATION_EVENT_OPTIONS = mapOptions(
  QC_NOTIFICATION_EVENT_VALUES,
  QC_NOTIFICATION_EVENT_LABELS,
);

export function isQcPermissionRole(value: string): value is QcPermissionRole {
  return QC_PERMISSION_ROLE_VALUES.includes(value as QcPermissionRole);
}

export function isQcInspectionStatus(value: string): value is QcInspectionStatus {
  return QC_INSPECTION_STATUS_VALUES.includes(value as QcInspectionStatus);
}

export function isQcAttachmentCategory(value: string): value is QcAttachmentCategory {
  return QC_ATTACHMENT_CATEGORY_VALUES.includes(value as QcAttachmentCategory);
}

export function isQcNotificationEvent(value: string): value is QcNotificationEvent {
  return QC_NOTIFICATION_EVENT_VALUES.includes(value as QcNotificationEvent);
}
