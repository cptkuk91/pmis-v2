export const EQUIPMENT_UNIT_OPTIONS = ["대", "식", "일", "월", "시간"] as const;

export type EquipmentUnit = (typeof EQUIPMENT_UNIT_OPTIONS)[number];

export const DEFAULT_EQUIPMENT_UNIT: EquipmentUnit = "대";

export function isEquipmentUnit(value: string): value is EquipmentUnit {
  return EQUIPMENT_UNIT_OPTIONS.includes(value as EquipmentUnit);
}

export function normalizeEquipmentUnit(value: unknown): EquipmentUnit {
  const unit = String(value ?? DEFAULT_EQUIPMENT_UNIT).trim();
  return isEquipmentUnit(unit) ? unit : DEFAULT_EQUIPMENT_UNIT;
}
