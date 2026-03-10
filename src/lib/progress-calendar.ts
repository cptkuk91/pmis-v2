import { VALIDATION_ERROR } from "@/lib/api-error";
import {
  PROGRESS_CALENDAR_CATEGORY_META,
  isLegacyExcludedProgressCalendarCategory,
  normalizeProgressCalendarCategory,
  type ProgressCalendarCategory,
} from "@/lib/progress-calendar-category";

export type ProgressCalendarPayload = {
  title: string;
  category: ProgressCalendarCategory;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  description: string;
  color: string;
};

function parseDateValue(rawValue: unknown, fieldName: string): Date {
  const parsed = new Date(String(rawValue ?? ""));
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldName} 형식이 올바르지 않습니다.`);
  }
  return parsed;
}

export function normalizeProgressCalendarPayload(
  body: Record<string, unknown>,
  options: {
    defaultCategory?: ProgressCalendarCategory;
    defaultIsAllDay?: boolean;
  } = {},
): ProgressCalendarPayload {
  const title = String(body.title ?? "").trim();
  if (!title) {
    throw VALIDATION_ERROR("title은 필수입니다.");
  }

  const rawCategory = String(body.category ?? options.defaultCategory ?? "general").trim();
  if (isLegacyExcludedProgressCalendarCategory(rawCategory)) {
    throw VALIDATION_ERROR("회의 일정은 회의 관리 메뉴에서 등록하세요.");
  }

  const category = normalizeProgressCalendarCategory(rawCategory);
  const startDate = parseDateValue(body.startDate, "startDate");
  const endDate = parseDateValue(body.endDate ?? body.startDate, "endDate");
  if (endDate.getTime() < startDate.getTime()) {
    throw VALIDATION_ERROR("endDate는 startDate보다 빠를 수 없습니다.");
  }

  const isAllDay =
    typeof body.isAllDay === "boolean" ? body.isAllDay : Boolean(options.defaultIsAllDay ?? true);

  return {
    title,
    category,
    startDate,
    endDate,
    isAllDay,
    description: String(body.description ?? "").trim(),
    color: PROGRESS_CALENDAR_CATEGORY_META[category].color,
  };
}
