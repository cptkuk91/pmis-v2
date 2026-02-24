import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import WisWorkerRecord from "@/models/WisWorkerRecord";

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

    const recordType = String(request.nextUrl.searchParams.get("type") ?? "all");
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId, isDeleted: { $ne: true } };
    if (recordType === "attendance" || recordType === "safety_education") {
      filter.recordType = recordType;
    }

    const [items, total] = await Promise.all([
      WisWorkerRecord.find(filter).sort({ recordDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      WisWorkerRecord.countDocuments(filter),
    ]);

    return paginated(items, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}
