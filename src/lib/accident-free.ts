type AccidentFreeStatus = "in_progress" | "achieved" | "failed";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calculateAccidentFreeDays(startDate: Date | null | undefined, now = new Date()) {
  if (!startDate) {
    return 0;
  }

  const start = startOfDay(startDate);
  const today = startOfDay(now);
  const diff = today.getTime() - start.getTime();

  if (diff < 0) {
    return 0;
  }

  return Math.floor(diff / 86_400_000) + 1;
}

export function resolveAccidentFreeStatus(params: {
  currentStatus: AccidentFreeStatus;
  achievedDays: number;
  targetDays: number;
}): AccidentFreeStatus {
  if (params.currentStatus === "failed") {
    return "failed";
  }

  if (params.targetDays > 0 && params.achievedDays >= params.targetDays) {
    return "achieved";
  }

  return "in_progress";
}
