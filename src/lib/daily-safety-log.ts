import { VALIDATION_ERROR } from "@/lib/api-error";
import type { Status } from "@/types";

export type DailySafetyLogPayload = {
  logDate: Date;
  weather: string;
  workersCount: number;
  hazards: string;
  actions: string;
  notes: string;
  managerName: string;
  status: Status;
};

type NormalizeOptions = {
  defaultStatus?: Status;
  defaultManagerName?: string;
};

export function isDailySafetyLogStatus(value: string): value is Status {
  return (
    value === "draft" ||
    value === "in_review" ||
    value === "approved" ||
    value === "rejected" ||
    value === "completed"
  );
}

export function normalizeDailySafetyLogPayload(
  body: Record<string, unknown>,
  options: NormalizeOptions = {},
): DailySafetyLogPayload {
  const logDate = body.logDate ? new Date(String(body.logDate)) : new Date();
  if (Number.isNaN(logDate.getTime())) {
    throw VALIDATION_ERROR("logDate 형식이 올바르지 않습니다.");
  }

  const statusInput = String(body.status ?? options.defaultStatus ?? "draft").trim();
  if (!isDailySafetyLogStatus(statusInput)) {
    throw VALIDATION_ERROR("status 값이 올바르지 않습니다.");
  }

  const workersCount = Number(body.workersCount ?? 0);

  return {
    logDate,
    weather: String(body.weather ?? "").trim(),
    workersCount: Number.isFinite(workersCount) ? Math.max(0, workersCount) : 0,
    hazards: String(body.hazards ?? "").trim(),
    actions: String(body.actions ?? "").trim(),
    notes: String(body.notes ?? "").trim(),
    managerName:
      String(body.managerName ?? options.defaultManagerName ?? "현장소장").trim() || "현장소장",
    status: statusInput,
  };
}
