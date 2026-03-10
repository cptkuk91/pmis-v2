import { VALIDATION_ERROR } from "@/lib/api-error";
import Site from "@/models/Site";
import WeatherSnapshot from "@/models/WeatherSnapshot";
import { fetchOpenMeteoDaily } from "@/lib/open-meteo";
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

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type DailySafetyLogWeatherResult = {
  condition: string;
  source: "open-meteo" | "snapshot" | "unavailable";
};

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

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

export async function resolveDailySafetyLogWeather(options: {
  siteId: string;
  logDate: Date;
}): Promise<DailySafetyLogWeatherResult> {
  const dateKey = toDateKey(options.logDate);
  const observedDate = toUtcDate(dateKey);

  const snapshot = await WeatherSnapshot.findOne({
    siteId: options.siteId,
    observedDate,
  })
    .select({ condition: 1 })
    .lean();

  if (snapshot?.condition) {
    return {
      condition: String(snapshot.condition).trim(),
      source: "snapshot",
    };
  }

  const site = await Site.findById(options.siteId)
    .select({ siteName: 1, address: 1, latitude: 1, longitude: 1 })
    .lean();
  if (!site) {
    return { condition: "", source: "unavailable" };
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const targetUtc = toUtcDate(dateKey);
  const dayDiff = Math.round((targetUtc.getTime() - todayUtc.getTime()) / DAY_IN_MS);

  if (dayDiff < 0 || dayDiff > 13) {
    return { condition: "", source: "unavailable" };
  }

  try {
    const openMeteo = await fetchOpenMeteoDaily({
      address: site.address,
      siteName: site.siteName,
      latitude: site.latitude,
      longitude: site.longitude,
      days: dayDiff + 1,
    });
    const matched = openMeteo.weather.find((item) => item.observedDate.slice(0, 10) === dateKey);

    if (!matched?.condition) {
      return { condition: "", source: "unavailable" };
    }

    return {
      condition: matched.condition,
      source: "open-meteo",
    };
  } catch {
    return { condition: "", source: "unavailable" };
  }
}
