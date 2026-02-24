import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import DesignChange from "@/models/DesignChange";
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

function isValidStatus(value: string): boolean {
  return ["draft", "in_review", "approved", "rejected", "completed"].includes(value);
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
    const sort = request.nextUrl.searchParams.get("sort") ?? "latest";
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { changeNo: regex },
        { drawingNo: regex },
        { drawingName: regex },
        { location: regex },
        { reason: regex },
      ];
    }
    if (status !== "all" && isValidStatus(status)) {
      filter.status = status;
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      latest: { requestedAt: -1, createdAt: -1 },
      oldest: { requestedAt: 1, createdAt: 1 },
      no_asc: { changeNo: 1 },
      no_desc: { changeNo: -1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.latest;

    const [items, total] = await Promise.all([
      DesignChange.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
      DesignChange.countDocuments(filter),
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
    const changeNo = String(body.changeNo ?? "").trim();
    const drawingNo = String(body.drawingNo ?? "").trim();
    const drawingName = String(body.drawingName ?? "").trim();
    if (!changeNo) {
      throw VALIDATION_ERROR("변경번호는 필수입니다.");
    }
    if (!drawingNo) {
      throw VALIDATION_ERROR("도면번호는 필수입니다.");
    }
    if (!drawingName) {
      throw VALIDATION_ERROR("도면명은 필수입니다.");
    }

    const requestedStatus = String(body.status ?? "in_review");
    const status = isValidStatus(requestedStatus) ? requestedStatus : "in_review";

    const created = await DesignChange.create({
      siteId,
      changeNo,
      drawingNo,
      drawingName,
      location: String(body.location ?? "").trim(),
      reason: String(body.reason ?? "").trim(),
      requestedByName: String(body.requestedByName ?? requester.userName).trim(),
      reviewedByName: String(body.reviewedByName ?? "").trim(),
      status,
      requestedAt: body.requestedAt ? new Date(String(body.requestedAt)) : new Date(),
      reviewedAt: body.reviewedAt ? new Date(String(body.reviewedAt)) : undefined,
      reviewComment: String(body.reviewComment ?? "").trim(),
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(String(siteId), "design_change", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
