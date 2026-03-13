export const QC_ITP_STATUS_VALUES = ["draft", "active", "archived"] as const;
export type QcItpStatus = (typeof QC_ITP_STATUS_VALUES)[number];

export const QC_ITP_STATUS_LABELS: Record<QcItpStatus, string> = {
  draft: "임시저장",
  active: "운영중",
  archived: "보관",
};

export const QC_ITP_ITEM_TYPE_VALUES = ["inspection", "test"] as const;
export type QcItpItemType = (typeof QC_ITP_ITEM_TYPE_VALUES)[number];

export const QC_ITP_ITEM_TYPE_LABELS: Record<QcItpItemType, string> = {
  inspection: "검사",
  test: "시험",
};

export const QC_ITP_HOLD_POINT_VALUES = ["none", "hold", "witness"] as const;
export type QcItpHoldPoint = (typeof QC_ITP_HOLD_POINT_VALUES)[number];

export const QC_ITP_HOLD_POINT_LABELS: Record<QcItpHoldPoint, string> = {
  none: "일반",
  hold: "Hold",
  witness: "Witness",
};

export function isQcItpStatus(value: string): value is QcItpStatus {
  return QC_ITP_STATUS_VALUES.includes(value as QcItpStatus);
}

export function isQcItpItemType(value: string): value is QcItpItemType {
  return QC_ITP_ITEM_TYPE_VALUES.includes(value as QcItpItemType);
}

export function isQcItpHoldPoint(value: string): value is QcItpHoldPoint {
  return QC_ITP_HOLD_POINT_VALUES.includes(value as QcItpHoldPoint);
}
