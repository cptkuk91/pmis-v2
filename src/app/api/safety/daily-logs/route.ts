import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import DailySafetyLog from "@/models/DailySafetyLog";
import { logCreate } from "@/lib/audit-logger";
import { isDailySafetyLogStatus, normalizeDailySafetyLogPayload } from "@/lib/daily-safety-log";

function parsePositiveInt(rawValue: string | null, fallback: number, max = 100): number {
  const parsed = Number(rawValue ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success([]);
    }

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const status = String(request.nextUrl.searchParams.get("status") ?? "all").trim();
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [{ weather: regex }, { hazards: regex }, { actions: regex }, { notes: regex }];
    }
    if (status !== "all" && isDailySafetyLogStatus(status)) {
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      DailySafetyLog.find(filter).sort({ logDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      DailySafetyLog.countDocuments(filter),
    ]);

    return paginated(items, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeDailySafetyLogPayload(body, {
      defaultStatus: "draft",
      defaultManagerName: requester.userName,
    });

    const created = await DailySafetyLog.create({
      siteId,
      logDate: payload.logDate,
      weather: payload.weather,
      workersCount: payload.workersCount,
      hazards: payload.hazards,
      actions: payload.actions,
      notes: payload.notes,
      managerName: payload.managerName,
      status: payload.status,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(String(siteId), "daily_safety_log", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
