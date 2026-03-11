export const SYSTEM_CODE_GROUP_MAP = {
  partners: "PARTNERS",
  materials: "MATERIALS",
  equipment: "EQUIPMENT",
  "material-specifications": "MATERIAL_SPECIFICATIONS",
  "equipment-specifications": "EQUIPMENT_SPECIFICATIONS",
  "job-types": "JOB_TYPES",
  "work-types": "WORK_TYPES",
} as const;

export type SystemCodeRouteGroup = keyof typeof SYSTEM_CODE_GROUP_MAP;

export function normalizeSystemCodeGroupCode(groupCode: string): string {
  return SYSTEM_CODE_GROUP_MAP[groupCode as SystemCodeRouteGroup] ?? groupCode.toUpperCase();
}

export const JOB_TYPE_GROUP_CODE = SYSTEM_CODE_GROUP_MAP["job-types"];
export const WORK_TYPE_GROUP_CODE = SYSTEM_CODE_GROUP_MAP["work-types"];
