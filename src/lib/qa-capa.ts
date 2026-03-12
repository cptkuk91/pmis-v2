export const QA_CAPA_SOURCE_TYPE_VALUES = ["audit", "manual"] as const;
export type QaCapaSourceType = (typeof QA_CAPA_SOURCE_TYPE_VALUES)[number];

export const QA_CAPA_SOURCE_TYPE_LABELS: Record<QaCapaSourceType, string> = {
  audit: "심사 연계",
  manual: "수동 등록",
};

export const QA_CAPA_ACTION_TYPE_VALUES = ["corrective", "preventive"] as const;
export type QaCapaActionType = (typeof QA_CAPA_ACTION_TYPE_VALUES)[number];

export const QA_CAPA_ACTION_TYPE_LABELS: Record<QaCapaActionType, string> = {
  corrective: "시정조치",
  preventive: "예방조치",
};

export const QA_CAPA_PRIORITY_VALUES = ["low", "medium", "high", "critical"] as const;
export type QaCapaPriority = (typeof QA_CAPA_PRIORITY_VALUES)[number];

export const QA_CAPA_PRIORITY_LABELS: Record<QaCapaPriority, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  critical: "긴급",
};

export const QA_CAPA_STATUS_VALUES = ["open", "in_progress", "verification", "completed"] as const;
export type QaCapaStatus = (typeof QA_CAPA_STATUS_VALUES)[number];

export const QA_CAPA_STATUS_LABELS: Record<QaCapaStatus, string> = {
  open: "등록",
  in_progress: "조치중",
  verification: "검증대기",
  completed: "완료",
};

export const QA_CAPA_STATUS_TRANSITIONS: Record<QaCapaStatus, QaCapaStatus[]> = {
  open: ["in_progress"],
  in_progress: ["open", "verification"],
  verification: ["in_progress", "completed"],
  completed: ["verification"],
};

export const QA_CAPA_WHY_ANALYSIS_STEPS = [1, 2, 3, 4, 5] as const;
export const QA_CAPA_ESCALATION_DAYS = 3;

function toDateKey(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export function isQaCapaSourceType(value: string): value is QaCapaSourceType {
  return QA_CAPA_SOURCE_TYPE_VALUES.includes(value as QaCapaSourceType);
}

export function isQaCapaActionType(value: string): value is QaCapaActionType {
  return QA_CAPA_ACTION_TYPE_VALUES.includes(value as QaCapaActionType);
}

export function isQaCapaPriority(value: string): value is QaCapaPriority {
  return QA_CAPA_PRIORITY_VALUES.includes(value as QaCapaPriority);
}

export function isQaCapaStatus(value: string): value is QaCapaStatus {
  return QA_CAPA_STATUS_VALUES.includes(value as QaCapaStatus);
}

export function canTransitionQaCapaStatus(from: QaCapaStatus, to: QaCapaStatus) {
  return from === to || QA_CAPA_STATUS_TRANSITIONS[from].includes(to);
}

export function isQaCapaOverdue(
  dueDate: Date | string | null | undefined,
  status: QaCapaStatus,
  referenceDate: Date = new Date(),
) {
  if (status === "completed") {
    return false;
  }

  const dueKey = toDateKey(dueDate);
  if (!dueKey) {
    return false;
  }

  return dueKey < toDateKey(referenceDate);
}

export function getQaCapaOverdueDays(
  dueDate: Date | string | null | undefined,
  status: QaCapaStatus,
  referenceDate: Date = new Date(),
) {
  if (!isQaCapaOverdue(dueDate, status, referenceDate)) {
    return 0;
  }

  const dueKey = toDateKey(dueDate);
  const referenceKey = toDateKey(referenceDate);
  if (!dueKey || !referenceKey) {
    return 0;
  }

  const dueUtc = new Date(`${dueKey}T00:00:00.000Z`);
  const referenceUtc = new Date(`${referenceKey}T00:00:00.000Z`);
  return Math.max(0, Math.floor((referenceUtc.getTime() - dueUtc.getTime()) / 86400000));
}

export function isQaCapaEscalated(
  priority: QaCapaPriority,
  status: QaCapaStatus,
  dueDate: Date | string | null | undefined,
  referenceDate: Date = new Date(),
) {
  if (!isQaCapaOverdue(dueDate, status, referenceDate)) {
    return false;
  }

  if (priority === "high" || priority === "critical") {
    return true;
  }

  return getQaCapaOverdueDays(dueDate, status, referenceDate) >= QA_CAPA_ESCALATION_DAYS;
}
