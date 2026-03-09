export const ACCIDENT_TYPES = [
  "추락",
  "전도",
  "낙하물",
  "협착",
  "충돌",
  "감전",
  "화재·폭발",
  "붕괴",
  "중장비",
  "기타",
] as const;

export type AccidentType = (typeof ACCIDENT_TYPES)[number];

export const DEFAULT_ACCIDENT_TYPE: AccidentType = ACCIDENT_TYPES[0];

export function isAccidentType(value: string): value is AccidentType {
  return ACCIDENT_TYPES.includes(value as AccidentType);
}
