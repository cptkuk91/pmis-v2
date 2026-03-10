export type ProgressCalendarCategory = "general" | "milestone" | "inspection";

export const PROGRESS_CALENDAR_CATEGORY_ORDER: ProgressCalendarCategory[] = [
  "general",
  "milestone",
  "inspection",
];

export const PROGRESS_CALENDAR_CATEGORY_META: Record<
  ProgressCalendarCategory,
  {
    label: string;
    color: string;
  }
> = {
  general: { label: "일반", color: "#2f76d2" },
  milestone: { label: "마일스톤", color: "#7c5cff" },
  inspection: { label: "점검", color: "#cc7a00" },
};

export function isProgressCalendarCategory(value: string): value is ProgressCalendarCategory {
  return value === "general" || value === "milestone" || value === "inspection";
}

export function normalizeProgressCalendarCategory(rawValue: unknown): ProgressCalendarCategory {
  const raw = String(rawValue ?? "general").trim();
  if (isProgressCalendarCategory(raw)) {
    return raw;
  }
  return "general";
}

export function isLegacyExcludedProgressCalendarCategory(value: string): boolean {
  return value === "meeting";
}
