import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import DesignChange from "@/models/DesignChange";
import Drawing from "@/models/Drawing";
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

function toChangeSummary(item: {
  _id: unknown;
  changeNo: string;
  drawingId?: unknown;
  drawingNo: string;
  drawingName: string;
  location?: string;
  reason?: string;
  requestedByName?: string;
  status: string;
  requestedAt?: Date;
}) {
  return {
    _id: String(item._id),
    changeNo: item.changeNo,
    drawingId: item.drawingId ? String(item.drawingId) : null,
    drawingNo: item.drawingNo,
    drawingName: item.drawingName,
    location: item.location ?? "",
    reason: item.reason ?? "",
    requestedByName: item.requestedByName ?? "",
    status: item.status,
    requestedAt: item.requestedAt ?? null,
  };
}

async function resolveDrawingReference(siteId: string, drawingIdRaw: unknown) {
  const drawingId = String(drawingIdRaw ?? "").trim();
  if (!mongoose.Types.ObjectId.isValid(drawingId)) {
    throw VALIDATION_ERROR("drawingId 값이 올바르지 않습니다.");
  }

  const drawing = await Drawing.findOne({
    _id: new mongoose.Types.ObjectId(drawingId),
    siteId: new mongoose.Types.ObjectId(siteId),
    isDeleted: false,
  })
    .select({ _id: 1, drawingNo: 1, drawingName: 1, location: 1 })
    .lean();

  if (!drawing) {
    throw new ApiError("선택한 도면을 찾을 수 없습니다.", 404, "DRAWING_NOT_FOUND");
  }

  return {
    drawingId: String(drawing._id),
    drawingNo: String(drawing.drawingNo ?? ""),
    drawingName: String(drawing.drawingName ?? ""),
    location: String(drawing.location ?? ""),
  };
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

    return paginated(items.map(toChangeSummary), page, limit, total);
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
    if (!changeNo) {
      throw VALIDATION_ERROR("변경번호는 필수입니다.");
    }
    const drawing = await resolveDrawingReference(siteId, body.drawingId);

    const requestedStatus = String(body.status ?? "in_review");
    const status = isValidStatus(requestedStatus) ? requestedStatus : "in_review";

    const created = await DesignChange.create({
      siteId,
      changeNo,
      drawingId: new mongoose.Types.ObjectId(drawing.drawingId),
      drawingNo: drawing.drawingNo,
      drawingName: drawing.drawingName,
      location: String(body.location ?? "").trim() || drawing.location,
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
    return success(toChangeSummary(created.toObject()));
  } catch (err) {
    return handleApiError(err);
  }
}
