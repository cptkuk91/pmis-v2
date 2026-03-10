import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { error, success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import WeatherSnapshot from "@/models/WeatherSnapshot";
import Site from "@/models/Site";
import { fetchOpenMeteoDaily } from "@/lib/open-meteo";

function parsePositiveInt(rawValue: string | null, fallback: number, max = 31): number {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const days = parsePositiveInt(request.nextUrl.searchParams.get("days"), 7);
    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return error("현재 선택된 현장 정보를 찾을 수 없어 날씨를 조회할 수 없습니다.", 404);
    }

    const fromDateRaw = request.nextUrl.searchParams.get("from");
    const site = await Site.findById(siteId)
      .select({ siteName: 1, address: 1, latitude: 1, longitude: 1 })
      .lean();
    if (!site) {
      return error("현장 정보를 찾을 수 없어 날씨를 조회할 수 없습니다.", 404);
    }

    let openMeteoError: string | null = null;
    try {
      const openMeteo = await fetchOpenMeteoDaily({
        address: site.address,
        siteName: site.siteName,
        latitude: site.latitude,
        longitude: site.longitude,
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
    } catch (fetchError) {
      openMeteoError =
        fetchError instanceof Error ? fetchError.message : "현장 날씨 데이터를 조회할 수 없습니다.";
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
        siteName: site.siteName ?? "",
        siteAddress: site.address ?? "",
      });
    }

    return error(openMeteoError ?? "현장 날씨 데이터를 조회할 수 없습니다.", 502);
  } catch (err) {
    return handleApiError(err);
  }
}
