export const QA_PARTNER_SOURCE_VALUES = ["system_code", "approved_supplier", "manual"] as const;
export type QaPartnerSource = (typeof QA_PARTNER_SOURCE_VALUES)[number];

export const QA_PARTNER_SOURCE_LABELS: Record<QaPartnerSource, string> = {
  system_code: "협력사 코드",
  approved_supplier: "승인 업체",
  manual: "직접 입력",
};

export const QA_PARTNER_CATEGORY_VALUES = [
  "subcontractor",
  "material_supplier",
  "equipment_supplier",
  "service",
] as const;
export type QaPartnerCategory = (typeof QA_PARTNER_CATEGORY_VALUES)[number];

export const QA_PARTNER_CATEGORY_LABELS: Record<QaPartnerCategory, string> = {
  subcontractor: "협력업체",
  material_supplier: "자재업체",
  equipment_supplier: "장비업체",
  service: "서비스업체",
};

export const QA_PARTNER_EVALUATION_TYPE_VALUES = ["regular", "special"] as const;
export type QaPartnerEvaluationType = (typeof QA_PARTNER_EVALUATION_TYPE_VALUES)[number];

export const QA_PARTNER_EVALUATION_TYPE_LABELS: Record<QaPartnerEvaluationType, string> = {
  regular: "정기 평가",
  special: "수시 평가",
};

export const QA_PARTNER_ASSURANCE_STATUS_VALUES = ["draft", "in_review", "follow_up", "completed"] as const;
export type QaPartnerAssuranceStatus = (typeof QA_PARTNER_ASSURANCE_STATUS_VALUES)[number];

export const QA_PARTNER_ASSURANCE_STATUS_LABELS: Record<QaPartnerAssuranceStatus, string> = {
  draft: "임시저장",
  in_review: "검토중",
  follow_up: "후속조치",
  completed: "완료",
};

export const QA_PARTNER_FOLLOW_UP_STATUS_VALUES = ["not_required", "requested", "completed"] as const;
export type QaPartnerFollowUpStatus = (typeof QA_PARTNER_FOLLOW_UP_STATUS_VALUES)[number];

export const QA_PARTNER_FOLLOW_UP_STATUS_LABELS: Record<QaPartnerFollowUpStatus, string> = {
  not_required: "후속조치 없음",
  requested: "개선 요청",
  completed: "조치 완료",
};

export const QA_PARTNER_CRITERION_CATEGORY_VALUES = [
  "quality_system",
  "document",
  "delivery",
  "response",
] as const;
export type QaPartnerCriterionCategory = (typeof QA_PARTNER_CRITERION_CATEGORY_VALUES)[number];

export const QA_PARTNER_CRITERION_CATEGORY_LABELS: Record<QaPartnerCriterionCategory, string> = {
  quality_system: "품질 체계",
  document: "문서 대응",
  delivery: "납기/공정 대응",
  response: "이슈 대응",
};

export const QA_PARTNER_GRADE_VALUES = ["A", "B", "C", "D"] as const;
export type QaPartnerGrade = (typeof QA_PARTNER_GRADE_VALUES)[number];

export const QA_PARTNER_GRADE_LABELS: Record<QaPartnerGrade, string> = {
  A: "A 등급",
  B: "B 등급",
  C: "C 등급",
  D: "D 등급",
};

export const QA_PARTNER_RISK_LEVEL_VALUES = ["low", "medium", "high"] as const;
export type QaPartnerRiskLevel = (typeof QA_PARTNER_RISK_LEVEL_VALUES)[number];

export const QA_PARTNER_RISK_LEVEL_LABELS: Record<QaPartnerRiskLevel, string> = {
  low: "낮음",
  medium: "주의",
  high: "높음",
};

export const QA_PARTNER_DEFAULT_CRITERIA = [
  {
    criterionCategory: "quality_system" as const,
    criterionTitle: "품질 시스템 운영",
    maxScore: 25,
  },
  {
    criterionCategory: "document" as const,
    criterionTitle: "서류/시험성적서 대응",
    maxScore: 25,
  },
  {
    criterionCategory: "delivery" as const,
    criterionTitle: "납기 및 공정 대응",
    maxScore: 25,
  },
  {
    criterionCategory: "response" as const,
    criterionTitle: "이슈 및 클레임 대응",
    maxScore: 25,
  },
] as const;

export function isQaPartnerSource(value: string): value is QaPartnerSource {
  return QA_PARTNER_SOURCE_VALUES.includes(value as QaPartnerSource);
}

export function isQaPartnerCategory(value: string): value is QaPartnerCategory {
  return QA_PARTNER_CATEGORY_VALUES.includes(value as QaPartnerCategory);
}

export function isQaPartnerEvaluationType(value: string): value is QaPartnerEvaluationType {
  return QA_PARTNER_EVALUATION_TYPE_VALUES.includes(value as QaPartnerEvaluationType);
}

export function isQaPartnerAssuranceStatus(value: string): value is QaPartnerAssuranceStatus {
  return QA_PARTNER_ASSURANCE_STATUS_VALUES.includes(value as QaPartnerAssuranceStatus);
}

export function isQaPartnerFollowUpStatus(value: string): value is QaPartnerFollowUpStatus {
  return QA_PARTNER_FOLLOW_UP_STATUS_VALUES.includes(value as QaPartnerFollowUpStatus);
}

export function isQaPartnerCriterionCategory(value: string): value is QaPartnerCriterionCategory {
  return QA_PARTNER_CRITERION_CATEGORY_VALUES.includes(value as QaPartnerCriterionCategory);
}

export function isQaPartnerGrade(value: string): value is QaPartnerGrade {
  return QA_PARTNER_GRADE_VALUES.includes(value as QaPartnerGrade);
}

export function isQaPartnerRiskLevel(value: string): value is QaPartnerRiskLevel {
  return QA_PARTNER_RISK_LEVEL_VALUES.includes(value as QaPartnerRiskLevel);
}

export function getQaPartnerGrade(totalScore: number, maxScore: number): QaPartnerGrade {
  if (maxScore <= 0) {
    return "D";
  }

  const ratio = totalScore / maxScore;
  if (ratio >= 0.9) {
    return "A";
  }
  if (ratio >= 0.8) {
    return "B";
  }
  if (ratio >= 0.7) {
    return "C";
  }
  return "D";
}

export function needsQaPartnerFollowUp(grade: QaPartnerGrade, improvementCount: number) {
  return grade === "C" || grade === "D" || improvementCount > 0;
}

export function getQaPartnerRiskLevel(
  grade: QaPartnerGrade,
  improvementCount: number,
  followUpStatus: QaPartnerFollowUpStatus,
): QaPartnerRiskLevel {
  if (grade === "D" || improvementCount >= 2) {
    return "high";
  }
  if (grade === "C" || improvementCount === 1 || followUpStatus === "requested") {
    return "medium";
  }
  return "low";
}
