export const SAFETY_MILEAGE_CATEGORIES = [
  "안전제안",
  "위험요인 제보",
  "개선조치",
  "우수점검",
  "교육참여",
  "캠페인참여",
  "우수사례 공유",
  "기타",
] as const;

export type SafetyMileageCategory = (typeof SAFETY_MILEAGE_CATEGORIES)[number];

export const DEFAULT_SAFETY_MILEAGE_CATEGORY: SafetyMileageCategory =
  SAFETY_MILEAGE_CATEGORIES[0];

export function isSafetyMileageCategory(value: string): value is SafetyMileageCategory {
  return SAFETY_MILEAGE_CATEGORIES.includes(value as SafetyMileageCategory);
}

export function normalizeSafetyMileageCategory(value: unknown): SafetyMileageCategory {
  const category = String(value ?? "").trim();
  return isSafetyMileageCategory(category) ? category : DEFAULT_SAFETY_MILEAGE_CATEGORY;
}
