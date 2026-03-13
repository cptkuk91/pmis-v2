import {
  QC_ATTACHMENT_CATEGORY_LABELS,
  QC_ATTACHMENT_CATEGORY_VALUES,
  type QcAttachmentCategory,
} from "@/lib/qc-core";

export const QC_TEST_REPORT_TYPE_VALUES = [
  "concrete_strength",
  "rebar_tension",
  "weld_inspection",
  "waterproof",
  "soil_density",
  "finish_quality",
  "other",
] as const;
export type QcTestReportType = (typeof QC_TEST_REPORT_TYPE_VALUES)[number];

export const QC_TEST_REPORT_TYPE_LABELS: Record<QcTestReportType, string> = {
  concrete_strength: "콘크리트 강도",
  rebar_tension: "철근 인장",
  weld_inspection: "용접 검사",
  waterproof: "방수 시험",
  soil_density: "토질 밀도",
  finish_quality: "마감 품질",
  other: "기타",
};

export const QC_TEST_REPORT_SOURCE_TYPE_VALUES = ["manual", "material_inspection", "process_inspection"] as const;
export type QcTestReportSourceType = (typeof QC_TEST_REPORT_SOURCE_TYPE_VALUES)[number];

export const QC_TEST_REPORT_SOURCE_TYPE_LABELS: Record<QcTestReportSourceType, string> = {
  manual: "직접 등록",
  material_inspection: "자재 검사 참조",
  process_inspection: "공정 검사 참조",
};

export const QC_TEST_REPORT_STATUS_VALUES = ["draft", "submitted", "reviewed", "approved"] as const;
export type QcTestReportStatus = (typeof QC_TEST_REPORT_STATUS_VALUES)[number];

export const QC_TEST_REPORT_STATUS_LABELS: Record<QcTestReportStatus, string> = {
  draft: "작성중",
  submitted: "검토 요청",
  reviewed: "검토 완료",
  approved: "승인 완료",
};

export const QC_TEST_REPORT_RESULT_VALUES = ["pending", "pass", "fail"] as const;
export type QcTestReportResult = (typeof QC_TEST_REPORT_RESULT_VALUES)[number];

export const QC_TEST_REPORT_RESULT_LABELS: Record<QcTestReportResult, string> = {
  pending: "대기",
  pass: "적합",
  fail: "부적합",
};

export const QC_TEST_REPORT_JUDGEMENT_RULE_VALUES = ["minimum", "maximum", "target_range"] as const;
export type QcTestReportJudgementRule = (typeof QC_TEST_REPORT_JUDGEMENT_RULE_VALUES)[number];

export const QC_TEST_REPORT_JUDGEMENT_RULE_LABELS: Record<QcTestReportJudgementRule, string> = {
  minimum: "기준 이상",
  maximum: "기준 이하",
  target_range: "허용 오차 내",
};

export const QC_TEST_REPORT_NCR_STATUS_VALUES = ["none", "recommended", "linked"] as const;
export type QcTestReportNcrStatus = (typeof QC_TEST_REPORT_NCR_STATUS_VALUES)[number];

export const QC_TEST_REPORT_NCR_STATUS_LABELS: Record<QcTestReportNcrStatus, string> = {
  none: "없음",
  recommended: "NCR 검토",
  linked: "NCR 연결",
};

export const QC_TEST_REPORT_HISTORY_ACTION_VALUES = [
  "created",
  "updated",
  "submitted",
  "reviewed",
  "approved",
  "version_updated",
] as const;
export type QcTestReportHistoryAction = (typeof QC_TEST_REPORT_HISTORY_ACTION_VALUES)[number];

export const QC_TEST_REPORT_HISTORY_ACTION_LABELS: Record<QcTestReportHistoryAction, string> = {
  created: "초기 등록",
  updated: "정보 수정",
  submitted: "검토 요청",
  reviewed: "검토 완료",
  approved: "승인 완료",
  version_updated: "버전 변경",
};

export const QC_TEST_REPORT_SORT_VALUES = [
  "test_date_desc",
  "test_date_asc",
  "sampling_date_desc",
  "type_asc",
  "updated_desc",
] as const;
export type QcTestReportSort = (typeof QC_TEST_REPORT_SORT_VALUES)[number];

export const QC_TEST_REPORT_SORT_LABELS: Record<QcTestReportSort, string> = {
  test_date_desc: "시험일 최신순",
  test_date_asc: "시험일 오래된순",
  sampling_date_desc: "채취일 최신순",
  type_asc: "시험 구분순",
  updated_desc: "최근 수정순",
};

export type QcTestReportAttachment = {
  fileAssetId: string;
  fileName: string;
  fileUrl?: string;
  category: QcAttachmentCategory;
  sortOrder: number;
};

export type QcTestReportHistoryEntry = {
  actionType: QcTestReportHistoryAction;
  status: QcTestReportStatus;
  result: QcTestReportResult;
  versionNo: number;
  note: string;
  actorName: string;
  actionDate: string;
};

export type QcTestReportEvaluation = {
  result: QcTestReportResult;
  deviationValue: number;
  deviationRate: number;
};

export const QC_TEST_REPORT_TYPE_OPTIONS = QC_TEST_REPORT_TYPE_VALUES.map((value) => ({
  value,
  label: QC_TEST_REPORT_TYPE_LABELS[value],
}));

export const QC_TEST_REPORT_SOURCE_TYPE_OPTIONS = QC_TEST_REPORT_SOURCE_TYPE_VALUES.map((value) => ({
  value,
  label: QC_TEST_REPORT_SOURCE_TYPE_LABELS[value],
}));

export const QC_TEST_REPORT_STATUS_OPTIONS = QC_TEST_REPORT_STATUS_VALUES.map((value) => ({
  value,
  label: QC_TEST_REPORT_STATUS_LABELS[value],
}));

export const QC_TEST_REPORT_RESULT_OPTIONS = QC_TEST_REPORT_RESULT_VALUES.map((value) => ({
  value,
  label: QC_TEST_REPORT_RESULT_LABELS[value],
}));

export const QC_TEST_REPORT_JUDGEMENT_RULE_OPTIONS = QC_TEST_REPORT_JUDGEMENT_RULE_VALUES.map((value) => ({
  value,
  label: QC_TEST_REPORT_JUDGEMENT_RULE_LABELS[value],
}));

export const QC_TEST_REPORT_NCR_STATUS_OPTIONS = QC_TEST_REPORT_NCR_STATUS_VALUES.map((value) => ({
  value,
  label: QC_TEST_REPORT_NCR_STATUS_LABELS[value],
}));

export const QC_TEST_REPORT_ATTACHMENT_CATEGORY_OPTIONS = QC_ATTACHMENT_CATEGORY_VALUES.map((value) => ({
  value,
  label: QC_ATTACHMENT_CATEGORY_LABELS[value],
}));

export function isQcTestReportType(value: string): value is QcTestReportType {
  return QC_TEST_REPORT_TYPE_VALUES.includes(value as QcTestReportType);
}

export function isQcTestReportSourceType(value: string): value is QcTestReportSourceType {
  return QC_TEST_REPORT_SOURCE_TYPE_VALUES.includes(value as QcTestReportSourceType);
}

export function isQcTestReportStatus(value: string): value is QcTestReportStatus {
  return QC_TEST_REPORT_STATUS_VALUES.includes(value as QcTestReportStatus);
}

export function isQcTestReportResult(value: string): value is QcTestReportResult {
  return QC_TEST_REPORT_RESULT_VALUES.includes(value as QcTestReportResult);
}

export function isQcTestReportJudgementRule(value: string): value is QcTestReportJudgementRule {
  return QC_TEST_REPORT_JUDGEMENT_RULE_VALUES.includes(value as QcTestReportJudgementRule);
}

export function isQcTestReportNcrStatus(value: string): value is QcTestReportNcrStatus {
  return QC_TEST_REPORT_NCR_STATUS_VALUES.includes(value as QcTestReportNcrStatus);
}

export function isQcTestReportSort(value: string): value is QcTestReportSort {
  return QC_TEST_REPORT_SORT_VALUES.includes(value as QcTestReportSort);
}

export function getQcTestReportSort(sort: QcTestReportSort): Record<string, 1 | -1> {
  switch (sort) {
    case "test_date_asc":
      return { testDate: 1, createdAt: 1 };
    case "sampling_date_desc":
      return { samplingDate: -1, createdAt: -1 };
    case "type_asc":
      return { testType: 1, testDate: -1 };
    case "updated_desc":
      return { updatedAt: -1, testDate: -1 };
    case "test_date_desc":
    default:
      return { testDate: -1, createdAt: -1 };
  }
}

export function computeQcTestReportEvaluation(input: {
  standardValue: number;
  measuredValue: number;
  toleranceValue: number;
  judgementRule: QcTestReportJudgementRule;
}): QcTestReportEvaluation {
  const standardValue = Number.isFinite(input.standardValue) ? input.standardValue : 0;
  const measuredValue = Number.isFinite(input.measuredValue) ? input.measuredValue : 0;
  const toleranceValue = Number.isFinite(input.toleranceValue) ? Math.max(0, input.toleranceValue) : 0;
  const baseline = standardValue === 0 ? 1 : Math.abs(standardValue);
  const rawDeviation = measuredValue - standardValue;
  const deviationRate = Math.abs(rawDeviation) / baseline * 100;

  if (input.judgementRule === "minimum") {
    return {
      result: measuredValue >= standardValue ? "pass" : "fail",
      deviationValue: rawDeviation,
      deviationRate,
    };
  }

  if (input.judgementRule === "maximum") {
    return {
      result: measuredValue <= standardValue ? "pass" : "fail",
      deviationValue: rawDeviation,
      deviationRate,
    };
  }

  return {
    result: Math.abs(rawDeviation) <= toleranceValue ? "pass" : "fail",
    deviationValue: rawDeviation,
    deviationRate,
  };
}
