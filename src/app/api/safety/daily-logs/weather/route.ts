import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { resolveDailySafetyLogWeather } from "@/lib/daily-safety-log";

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success({ condition: "", source: "unavailable" });
    }

    const dateRaw = String(request.nextUrl.searchParams.get("date") ?? "").trim();
    if (!dateRaw) {
      throw VALIDATION_ERROR("date가 필요합니다.");
    }

    const logDate = new Date(dateRaw);
    if (Number.isNaN(logDate.getTime())) {
      throw VALIDATION_ERROR("date 형식이 올바르지 않습니다.");
    }

    const weather = await resolveDailySafetyLogWeather({ siteId, logDate });
    return success(weather);
  } catch (err) {
    return handleApiError(err);
  }
}
