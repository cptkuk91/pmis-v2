import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import ProgressPhoto from "@/models/ProgressPhoto";
import { logCreate } from "@/lib/audit-logger";

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

function parseDate(rawValue: string | null): Date | null {
  if (!rawValue) {
    return null;
  }
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
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
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20, 200);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const fromDate = parseDate(request.nextUrl.searchParams.get("from"));
    const toDate = parseDate(request.nextUrl.searchParams.get("to"));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { title: regex },
        { location: regex },
        { description: regex },
        { uploadedByName: regex },
      ];
    }
    if (fromDate || toDate) {
      const shotDateFilter: Record<string, Date> = {};
      if (fromDate) {
        shotDateFilter.$gte = fromDate;
      }
      if (toDate) {
        shotDateFilter.$lte = toDate;
      }
      filter.shotDate = shotDateFilter;
    }

    const [items, total] = await Promise.all([
      ProgressPhoto.find(filter)
        .sort({ shotDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProgressPhoto.countDocuments(filter),
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
    const title = String(body.title ?? "").trim();
    if (!title) {
      throw VALIDATION_ERROR("title은 필수입니다.");
    }

    const shotDate = new Date(String(body.shotDate ?? ""));
    if (Number.isNaN(shotDate.getTime())) {
      throw VALIDATION_ERROR("shotDate 형식이 올바르지 않습니다.");
    }

    const created = await ProgressPhoto.create({
      siteId,
      title,
      shotDate,
      location: String(body.location ?? "").trim(),
      description: String(body.description ?? "").trim(),
      progressRate: clampProgress(Number(body.progressRate ?? 0)),
      uploadedByName: String(body.uploadedByName ?? requester.userName).trim(),
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(String(siteId), "progress_photo", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
