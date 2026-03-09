export const SAFETY_TRAINING_TYPES = [
  "신규채용자 교육",
  "정기안전교육",
  "특별안전교육",
  "작업전 안전교육",
  "TBM",
  "위험성평가 공유",
  "비상대응 훈련",
  "기타",
] as const;

export type SafetyTrainingType = (typeof SAFETY_TRAINING_TYPES)[number];

export const DEFAULT_SAFETY_TRAINING_TYPE: SafetyTrainingType = SAFETY_TRAINING_TYPES[0];

export function isSafetyTrainingType(value: string): value is SafetyTrainingType {
  return SAFETY_TRAINING_TYPES.includes(value as SafetyTrainingType);
}
