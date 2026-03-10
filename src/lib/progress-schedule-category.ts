export const PROGRESS_SCHEDULE_CATEGORY_META = {
  "공통/가설": { codePrefix: "COM" },
  "토공/흙막이": { codePrefix: "EAR" },
  기초: { codePrefix: "FND" },
  골조: { codePrefix: "STR" },
  "조적/미장": { codePrefix: "MAS" },
  방수: { codePrefix: "WPF" },
  "창호/금속": { codePrefix: "WIN" },
  마감: { codePrefix: "FIN" },
  기계설비: { codePrefix: "MEC" },
  전기: { codePrefix: "ELE" },
  통신: { codePrefix: "ICT" },
  소방: { codePrefix: "FIR" },
  "조경/외부부대": { codePrefix: "LAN" },
  "시운전/준공": { codePrefix: "CLS" },
} as const;

export type ProgressScheduleCategory = keyof typeof PROGRESS_SCHEDULE_CATEGORY_META;

export const PROGRESS_SCHEDULE_CATEGORIES = Object.keys(
  PROGRESS_SCHEDULE_CATEGORY_META,
) as ProgressScheduleCategory[];

export const DEFAULT_PROGRESS_SCHEDULE_CATEGORY: ProgressScheduleCategory = "공통/가설";
export const PROGRESS_SCHEDULE_TASK_CODE_DIGITS = 3;

export function isProgressScheduleCategory(value: string): value is ProgressScheduleCategory {
  return value in PROGRESS_SCHEDULE_CATEGORY_META;
}

export function getProgressScheduleCategoryCodePrefix(category: ProgressScheduleCategory): string {
  return PROGRESS_SCHEDULE_CATEGORY_META[category].codePrefix;
}

export function buildProgressScheduleTaskCode(
  category: ProgressScheduleCategory,
  sequence: number,
): string {
  const safeSequence = Math.max(1, Math.floor(sequence));
  return `${getProgressScheduleCategoryCodePrefix(category)}-${String(safeSequence).padStart(
    PROGRESS_SCHEDULE_TASK_CODE_DIGITS,
    "0",
  )}`;
}

export function parseProgressScheduleTaskCodeSequence(
  category: ProgressScheduleCategory,
  taskCode: string,
): number | null {
  const prefix = getProgressScheduleCategoryCodePrefix(category).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = taskCode.trim().match(new RegExp(`^${prefix}-(\\d+)$`));
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }

  return Math.floor(parsed);
}
