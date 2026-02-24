import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import IntegrationSyncLog from "@/models/IntegrationSyncLog";

function parsePositiveInt(rawValue: string | null, fallback: number, max = 100): number {
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

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success([]);
    }

    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20);
    const logs = await IntegrationSyncLog.find({
      siteId,
      sourceSystem: "wis",
      isDeleted: { $ne: true },
    })
      .sort({ startedAt: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return success(logs);
  } catch (err) {
    return handleApiError(err);
  }
}
