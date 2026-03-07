import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logCreate } from "@/lib/audit-logger";
import { DEFAULT_DRAWING_DISCIPLINE, isDrawingDiscipline } from "@/lib/drawing-discipline";
import Drawing from "@/models/Drawing";
import type { Status } from "@/types";

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

function isStatus(value: string): value is Status {
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
    const discipline = String(request.nextUrl.searchParams.get("discipline") ?? "all").trim();
    const status = String(request.nextUrl.searchParams.get("status") ?? "all").trim();
    const sort = request.nextUrl.searchParams.get("sort") ?? "latest";
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [{ drawingNo: regex }, { drawingName: regex }, { location: regex }];
    }
    if (discipline && discipline !== "all") {
      if (isDrawingDiscipline(discipline)) {
        filter.discipline = discipline;
      }
    }
    if (
      status === "draft" ||
      status === "in_review" ||
      status === "approved" ||
      status === "rejected" ||
      status === "completed"
    ) {
      filter.status = status;
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      no_asc: { drawingNo: 1 },
      no_desc: { drawingNo: -1 },
      name_asc: { drawingName: 1 },
      name_desc: { drawingName: -1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.latest;

    const [items, total] = await Promise.all([
      Drawing.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
      Drawing.countDocuments(filter),
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
    const drawingNo = String(body.drawingNo ?? "").trim();
    const drawingName = String(body.drawingName ?? "").trim();
    const rawDiscipline = String(body.discipline ?? "").trim();
    if (!drawingNo) {
      throw VALIDATION_ERROR("도면번호는 필수입니다.");
    }
    if (!drawingName) {
      throw VALIDATION_ERROR("도면명은 필수입니다.");
    }
    if (rawDiscipline && !isDrawingDiscipline(rawDiscipline)) {
      throw VALIDATION_ERROR("기술구분 값이 올바르지 않습니다.");
    }

    const rawFileAssetId = String(body.fileAssetId ?? "").trim();
    if (rawFileAssetId && !mongoose.Types.ObjectId.isValid(rawFileAssetId)) {
      throw VALIDATION_ERROR("fileAssetId 형식이 올바르지 않습니다.");
    }

    const requestedStatus = String(body.status ?? "draft");
    const status: Status = isStatus(requestedStatus) ? requestedStatus : "draft";

    const created = await Drawing.create({
      siteId,
      drawingNo,
      drawingName,
      discipline: rawDiscipline || DEFAULT_DRAWING_DISCIPLINE,
      location: String(body.location ?? "").trim(),
      revision: String(body.revision ?? "0").trim(),
      status,
      fileAssetId: rawFileAssetId || undefined,
      notes: String(body.notes ?? "").trim(),
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    logCreate(siteId, "drawing", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
