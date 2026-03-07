export const SAFETY_REGULATION_CATEGORIES = [
  "공통",
  "추락·낙하",
  "가설·비계",
  "양중·중장비",
  "전기",
  "화재·폭발",
  "밀폐공간",
  "화학물질",
  "보호구",
  "작업허가·TBM",
  "응급·비상",
] as const;

export type SafetyRegulationCategory = (typeof SAFETY_REGULATION_CATEGORIES)[number];

export const DEFAULT_SAFETY_REGULATION_CATEGORY: SafetyRegulationCategory = "공통";

export function isSafetyRegulationCategory(value: string): value is SafetyRegulationCategory {
  return SAFETY_REGULATION_CATEGORIES.includes(value as SafetyRegulationCategory);
}

export function normalizeSafetyRegulationCategory(value: unknown): SafetyRegulationCategory {
  const category = String(value ?? "").trim();
  return isSafetyRegulationCategory(category) ? category : DEFAULT_SAFETY_REGULATION_CATEGORY;
}
