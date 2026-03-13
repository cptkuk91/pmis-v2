import {
  QC_ATTACHMENT_CATEGORY_LABELS,
  QC_ATTACHMENT_CATEGORY_VALUES,
  type QcAttachmentCategory,
} from "@/lib/qc-core";

export const QC_MATERIAL_CATEGORY_VALUES = [
  "concrete",
  "rebar",
  "steel",
  "piping",
  "electrical",
  "finish",
  "equipment",
  "other",
] as const;
export type QcMaterialCategory = (typeof QC_MATERIAL_CATEGORY_VALUES)[number];

export const QC_MATERIAL_CATEGORY_LABELS: Record<QcMaterialCategory, string> = {
  concrete: "콘크리트",
  rebar: "철근",
  steel: "철골",
  piping: "배관",
  electrical: "전기",
  finish: "마감재",
  equipment: "설비",
  other: "기타",
};

export const QC_MATERIAL_INSPECTION_RESULT_VALUES = ["pending", "pass", "fail", "reinspection"] as const;
export type QcMaterialInspectionResult = (typeof QC_MATERIAL_INSPECTION_RESULT_VALUES)[number];

export const QC_MATERIAL_INSPECTION_RESULT_LABELS: Record<QcMaterialInspectionResult, string> = {
  pending: "대기",
  pass: "합격",
  fail: "불합격",
  reinspection: "재검",
};

export const QC_MATERIAL_INSPECTION_DISPOSITION_VALUES = ["none", "hold", "returned"] as const;
export type QcMaterialInspectionDisposition = (typeof QC_MATERIAL_INSPECTION_DISPOSITION_VALUES)[number];

export const QC_MATERIAL_INSPECTION_DISPOSITION_LABELS: Record<QcMaterialInspectionDisposition, string> = {
  none: "정상",
  hold: "보류",
  returned: "반출",
};

export const QC_MATERIAL_INSPECTION_CHECK_STATUS_VALUES = ["pending", "pass", "fail", "na"] as const;
export type QcMaterialInspectionCheckStatus = (typeof QC_MATERIAL_INSPECTION_CHECK_STATUS_VALUES)[number];

export const QC_MATERIAL_INSPECTION_CHECK_STATUS_LABELS: Record<QcMaterialInspectionCheckStatus, string> = {
  pending: "미확인",
  pass: "적합",
  fail: "부적합",
  na: "해당 없음",
};

export const QC_MATERIAL_INSPECTION_NCR_STATUS_VALUES = ["none", "recommended", "linked"] as const;
export type QcMaterialInspectionNcrStatus = (typeof QC_MATERIAL_INSPECTION_NCR_STATUS_VALUES)[number];

export const QC_MATERIAL_INSPECTION_NCR_STATUS_LABELS: Record<QcMaterialInspectionNcrStatus, string> = {
  none: "없음",
  recommended: "NCR 검토",
  linked: "NCR 연결",
};

export const QC_MATERIAL_INSPECTION_HISTORY_ACTION_VALUES = [
  "created",
  "updated",
  "held",
  "returned",
  "reinspection_requested",
  "reinspection_completed",
] as const;
export type QcMaterialInspectionHistoryAction = (typeof QC_MATERIAL_INSPECTION_HISTORY_ACTION_VALUES)[number];

export const QC_MATERIAL_INSPECTION_HISTORY_ACTION_LABELS: Record<QcMaterialInspectionHistoryAction, string> = {
  created: "초기 등록",
  updated: "정보 수정",
  held: "보류 처리",
  returned: "반출 처리",
  reinspection_requested: "재검 요청",
  reinspection_completed: "재검 완료",
};

export const QC_MATERIAL_INSPECTION_SORT_VALUES = [
  "inspection_date_desc",
  "inspection_date_asc",
  "material_name",
  "updated_desc",
] as const;
export type QcMaterialInspectionSort = (typeof QC_MATERIAL_INSPECTION_SORT_VALUES)[number];

export const QC_MATERIAL_INSPECTION_SORT_LABELS: Record<QcMaterialInspectionSort, string> = {
  inspection_date_desc: "검수일 최신순",
  inspection_date_asc: "검수일 오래된순",
  material_name: "자재명순",
  updated_desc: "최근 수정순",
};

export type QcMaterialInspectionAttachment = {
  fileAssetId: string;
  fileName: string;
  fileUrl?: string;
  category: QcAttachmentCategory;
  sortOrder: number;
};

export type QcMaterialInspectionChecklistItem = {
  itemId: string;
  label: string;
  status: QcMaterialInspectionCheckStatus;
  note: string;
};

export type QcMaterialInspectionHistoryEntry = {
  actionType: QcMaterialInspectionHistoryAction;
  result: QcMaterialInspectionResult;
  disposition: QcMaterialInspectionDisposition;
  note: string;
  actorName: string;
  actionDate: string;
};

export const QC_MATERIAL_CATEGORY_OPTIONS = QC_MATERIAL_CATEGORY_VALUES.map((value) => ({
  value,
  label: QC_MATERIAL_CATEGORY_LABELS[value],
}));

export const QC_MATERIAL_INSPECTION_DISPOSITION_OPTIONS = QC_MATERIAL_INSPECTION_DISPOSITION_VALUES.map((value) => ({
  value,
  label: QC_MATERIAL_INSPECTION_DISPOSITION_LABELS[value],
}));

export const QC_MATERIAL_INSPECTION_CHECK_STATUS_OPTIONS = QC_MATERIAL_INSPECTION_CHECK_STATUS_VALUES.map((value) => ({
  value,
  label: QC_MATERIAL_INSPECTION_CHECK_STATUS_LABELS[value],
}));

export const QC_MATERIAL_INSPECTION_NCR_STATUS_OPTIONS = QC_MATERIAL_INSPECTION_NCR_STATUS_VALUES.map((value) => ({
  value,
  label: QC_MATERIAL_INSPECTION_NCR_STATUS_LABELS[value],
}));

export const QC_MATERIAL_INSPECTION_HISTORY_ACTION_OPTIONS = QC_MATERIAL_INSPECTION_HISTORY_ACTION_VALUES.map(
  (value) => ({
    value,
    label: QC_MATERIAL_INSPECTION_HISTORY_ACTION_LABELS[value],
  }),
);

export const QC_MATERIAL_INSPECTION_ATTACHMENT_CATEGORY_OPTIONS = QC_ATTACHMENT_CATEGORY_VALUES.map((value) => ({
  value,
  label: QC_ATTACHMENT_CATEGORY_LABELS[value],
}));

export function isQcMaterialInspectionResult(value: string): value is QcMaterialInspectionResult {
  return QC_MATERIAL_INSPECTION_RESULT_VALUES.includes(value as QcMaterialInspectionResult);
}

export function isQcMaterialInspectionSort(value: string): value is QcMaterialInspectionSort {
  return QC_MATERIAL_INSPECTION_SORT_VALUES.includes(value as QcMaterialInspectionSort);
}

export function isQcMaterialCategory(value: string): value is QcMaterialCategory {
  return QC_MATERIAL_CATEGORY_VALUES.includes(value as QcMaterialCategory);
}

export function isQcMaterialInspectionDisposition(value: string): value is QcMaterialInspectionDisposition {
  return QC_MATERIAL_INSPECTION_DISPOSITION_VALUES.includes(value as QcMaterialInspectionDisposition);
}

export function isQcMaterialInspectionCheckStatus(value: string): value is QcMaterialInspectionCheckStatus {
  return QC_MATERIAL_INSPECTION_CHECK_STATUS_VALUES.includes(value as QcMaterialInspectionCheckStatus);
}

export function isQcMaterialInspectionNcrStatus(value: string): value is QcMaterialInspectionNcrStatus {
  return QC_MATERIAL_INSPECTION_NCR_STATUS_VALUES.includes(value as QcMaterialInspectionNcrStatus);
}

export function getQcMaterialInspectionSort(sort: QcMaterialInspectionSort): Record<string, 1 | -1> {
  switch (sort) {
    case "inspection_date_asc":
      return { inspectionDate: 1, createdAt: 1 };
    case "material_name":
      return { materialName: 1, inspectionDate: -1 };
    case "updated_desc":
      return { updatedAt: -1, inspectionDate: -1 };
    case "inspection_date_desc":
    default:
      return { inspectionDate: -1, createdAt: -1 };
  }
}
