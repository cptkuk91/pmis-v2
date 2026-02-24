import mongoose from "mongoose";
import Site from "@/models/Site";
import WeatherSnapshot from "@/models/WeatherSnapshot";
import { fetchOpenMeteoDailyByAddress } from "@/lib/open-meteo";

type SyncResult = {
  siteId: string;
  siteName: string;
  siteAddress: string;
  processed: number;
  warningCount: number;
  locationName: string;
};

export async function syncOpenMeteoForSite(options: {
  siteId: string;
  days?: number;
  userId?: string | null;
}): Promise<SyncResult> {
  const days = Math.max(1, Math.min(14, Number(options.days ?? 7)));

  const site = await Site.findById(options.siteId).select({ siteName: 1, address: 1 }).lean();
  if (!site) {
    throw new Error("동기화 대상 현장을 찾을 수 없습니다.");
  }

  const weather = await fetchOpenMeteoDailyByAddress({
    address: site.address,
    siteName: site.siteName,
    days,
  });

  const userObjectId =
    options.userId && mongoose.Types.ObjectId.isValid(options.userId)
      ? new mongoose.Types.ObjectId(options.userId)
      : undefined;

  let processed = 0;
  for (const item of weather.weather) {
    const observedDate = new Date(item.observedDate);
    if (Number.isNaN(observedDate.getTime())) {
      continue;
    }

    await WeatherSnapshot.findOneAndUpdate(
      { siteId: options.siteId, observedDate },
      {
        $set: {
          condition: item.condition,
          temperatureMin: item.temperatureMin,
          temperatureMax: item.temperatureMax,
          precipitationChance: item.precipitationChance,
          windSpeed: item.windSpeed,
          warning: item.warning,
          source: item.source,
          ...(userObjectId ? { updatedBy: userObjectId } : {}),
        },
        $setOnInsert: {
          siteId: options.siteId,
          observedDate,
          ...(userObjectId ? { createdBy: userObjectId } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    processed += 1;
  }

  return {
    siteId: String(options.siteId),
    siteName: String(site.siteName ?? ""),
    siteAddress: String(site.address ?? ""),
    processed,
    warningCount: weather.weather.filter((item) => item.warning).length,
    locationName: weather.location.displayName,
  };
}
