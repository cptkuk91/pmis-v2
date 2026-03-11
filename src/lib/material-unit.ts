export const MATERIAL_UNIT_OPTIONS = [
  "EA",
  "SET",
  "M",
  "M2",
  "M3",
  "KG",
  "TON",
  "L",
  "ROLL",
] as const;

export type MaterialUnit = (typeof MATERIAL_UNIT_OPTIONS)[number];

export const DEFAULT_MATERIAL_UNIT: MaterialUnit = "EA";

export function isMaterialUnit(value: string): value is MaterialUnit {
  return MATERIAL_UNIT_OPTIONS.includes(value as MaterialUnit);
}

export function normalizeMaterialUnit(value: unknown): MaterialUnit {
  const unit = String(value ?? DEFAULT_MATERIAL_UNIT).trim().toUpperCase();
  return isMaterialUnit(unit) ? unit : DEFAULT_MATERIAL_UNIT;
}
