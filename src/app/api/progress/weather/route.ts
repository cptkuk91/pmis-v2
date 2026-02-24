import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import WeatherSnapshot from "@/models/WeatherSnapshot";
import Site from "@/models/Site";
import { fetchOpenMeteoDailyByAddress } from "@/lib/open-meteo";

function parsePositiveInt(rawValue: string | null, fallback: number, max = 31): number {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function createMockWeather(days: number) {
  const conditions = ["맑음", "구름많음", "흐림", "비", "소나기", "눈"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, index) => {
    const observedDate = new Date(today);
    observedDate.setDate(today.getDate() + index);

    const condition = conditions[index % conditions.length];
    const temperatureMin = 2 + (index % 6);
    const temperatureMax = temperatureMin + 6 + (index % 3);
    const precipitationChance = Math.min(100, index % 3 === 0 ? 60 : 15 + ((index * 7) % 40));
    const windSpeed = 2 + (index % 5);
    const warning = precipitationChance >= 60 ? "강수 주의" : windSpeed >= 6 ? "강풍 주의" : "";

    return {
      _id: `mock-${index + 1}`,
      observedDate: observedDate.toISOString(),
      condition,
      temperatureMin,
      temperatureMax,
      precipitationChance,
      windSpeed,
      warning,
      source: "mock",
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const days = parsePositiveInt(request.nextUrl.searchParams.get("days"), 7);
    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success(createMockWeather(days), {
        provider: "mock",
        reason: "site_not_found",
      });
    }

    const fromDateRaw = request.nextUrl.searchParams.get("from");
    const site = await Site.findById(siteId).select({ siteName: 1, address: 1 }).lean();

    if (site) {
      try {
        const openMeteo = await fetchOpenMeteoDailyByAddress({
          address: site.address,
          siteName: site.siteName,
          days,
        });

        return success(openMeteo.weather, {
          provider: "open-meteo",
          siteName: site.siteName,
          siteAddress: site.address ?? "",
          resolvedAddress: openMeteo.location.displayName,
          latitude: openMeteo.location.latitude,
          longitude: openMeteo.location.longitude,
          timezone: openMeteo.location.timezone,
        });
      } catch {
        // Open-Meteo 실패 시 DB 스냅샷/모의 데이터로 폴백
      }
    }

    const filter: Record<string, unknown> = { siteId };
    if (fromDateRaw) {
      const fromDate = new Date(fromDateRaw);
      if (!Number.isNaN(fromDate.getTime())) {
        filter.observedDate = { $gte: fromDate };
      }
    }

    const snapshots = await WeatherSnapshot.find(filter)
      .sort({ observedDate: 1, createdAt: 1 })
      .limit(days)
      .lean();

    if (snapshots.length > 0) {
      return success(snapshots, {
        provider: "snapshot",
        siteName: site?.siteName ?? "",
        siteAddress: site?.address ?? "",
      });
    }

    return success(createMockWeather(days), {
      provider: "mock",
      reason: "no_snapshot",
      siteName: site?.siteName ?? "",
      siteAddress: site?.address ?? "",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
