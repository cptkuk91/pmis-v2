export const SAFETY_CHECKLIST_CATEGORIES = [
  "일일 안전점검",
  "정기 안전점검",
  "특별 안전점검",
  "작업전 점검",
  "가설·비계 점검",
  "추락방지 점검",
  "양중·중장비 점검",
  "전기 점검",
  "화재예방 점검",
  "보호구 점검",
  "정리정돈 점검",
  "우기/동절기 점검",
] as const;

export type SafetyChecklistCategory = (typeof SAFETY_CHECKLIST_CATEGORIES)[number];

export const DEFAULT_SAFETY_CHECKLIST_CATEGORY: SafetyChecklistCategory = "일일 안전점검";

export function isSafetyChecklistCategory(value: string): value is SafetyChecklistCategory {
  return SAFETY_CHECKLIST_CATEGORIES.includes(value as SafetyChecklistCategory);
}

export function normalizeSafetyChecklistCategory(value: unknown): SafetyChecklistCategory {
  const category = String(value ?? "").trim();
  return isSafetyChecklistCategory(category) ? category : DEFAULT_SAFETY_CHECKLIST_CATEGORY;
}
