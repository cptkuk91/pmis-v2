export const DRAWING_DISCIPLINES = [
  "건축",
  "구조",
  "토목",
  "기계",
  "전기",
  "소방",
  "통신",
  "조경",
  "인테리어",
  "기타",
] as const;

export type DrawingDiscipline = (typeof DRAWING_DISCIPLINES)[number];

export const DEFAULT_DRAWING_DISCIPLINE: DrawingDiscipline = "건축";

export function isDrawingDiscipline(value: string): value is DrawingDiscipline {
  return DRAWING_DISCIPLINES.includes(value as DrawingDiscipline);
}

export function normalizeDrawingDiscipline(value: unknown): DrawingDiscipline {
  const discipline = String(value ?? "").trim();
  return isDrawingDiscipline(discipline) ? discipline : DEFAULT_DRAWING_DISCIPLINE;
}
