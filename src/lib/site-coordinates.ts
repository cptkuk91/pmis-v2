import { resolveOpenMeteoLocation } from "@/lib/open-meteo";

type CoordinateAxis = "latitude" | "longitude";

export type ParsedSiteCoordinateInput = {
  isProvided: boolean;
  latitude?: number;
  longitude?: number;
};

function normalizeCoordinatePrecision(value: number): number {
  return Number(value.toFixed(6));
}

export function parseSiteCoordinate(
  value: unknown,
  axis: CoordinateAxis,
): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed =
    typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`${axis} 값이 올바르지 않습니다.`);
  }

  const min = axis === "latitude" ? -90 : -180;
  const max = axis === "latitude" ? 90 : 180;
  if (parsed < min || parsed > max) {
    throw new Error(`${axis} 값이 허용 범위를 벗어났습니다.`);
  }

  return normalizeCoordinatePrecision(parsed);
}

export function parseSiteCoordinateInput(input: {
  latitude: unknown;
  longitude: unknown;
}): ParsedSiteCoordinateInput {
  const isProvided =
    input.latitude !== undefined || input.longitude !== undefined;
  if (!isProvided) {
    return { isProvided: false };
  }

  const latitude = parseSiteCoordinate(input.latitude, "latitude");
  const longitude = parseSiteCoordinate(input.longitude, "longitude");
  if ((latitude === undefined) !== (longitude === undefined)) {
    throw new Error("위도와 경도는 함께 입력해야 합니다.");
  }

  return { isProvided: true, latitude, longitude };
}

export function hasSiteCoordinates(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  return typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude);
}

export async function geocodeSiteCoordinates(options: {
  address?: string | null;
  siteName?: string | null;
}) {
  const address = String(options.address ?? "").trim();
  const siteName = String(options.siteName ?? "").trim();
  if (!address && !siteName) {
    return null;
  }

  const location = await resolveOpenMeteoLocation(address, siteName);
  return {
    latitude: normalizeCoordinatePrecision(location.latitude),
    longitude: normalizeCoordinatePrecision(location.longitude),
    resolvedAddress: location.displayName,
  };
}
