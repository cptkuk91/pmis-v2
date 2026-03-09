export const GOVERNMENT_REPORT_TYPES = [
  "착공신고",
  "도로점용허가",
  "굴착허가",
  "비산먼지 발생사업 신고",
  "특정공사 사전신고",
  "유해위험방지계획서 제출",
  "안전관리계획서 제출",
  "건설폐기물 배출자 신고",
  "가설건축물 축조신고",
  "기타",
] as const;

export type GovernmentReportType = (typeof GOVERNMENT_REPORT_TYPES)[number];

export const DEFAULT_GOVERNMENT_REPORT_TYPE: GovernmentReportType = "착공신고";

export function isGovernmentReportType(value: string): value is GovernmentReportType {
  return GOVERNMENT_REPORT_TYPES.includes(value as GovernmentReportType);
}

export const GOVERNMENT_REPORT_AGENCIES = [
  "관할 시청/구청",
  "고용노동부",
  "한국산업안전보건공단",
  "관할 소방서",
  "관할 경찰서",
  "도로관리청",
  "환경청/환경과",
  "발주처",
  "기타",
] as const;

export type GovernmentReportAgency = (typeof GOVERNMENT_REPORT_AGENCIES)[number];

export function isGovernmentReportAgency(value: string): value is GovernmentReportAgency {
  return GOVERNMENT_REPORT_AGENCIES.includes(value as GovernmentReportAgency);
}

export const GOVERNMENT_REPORT_AGENCY_VALUES = ["", ...GOVERNMENT_REPORT_AGENCIES] as const;
