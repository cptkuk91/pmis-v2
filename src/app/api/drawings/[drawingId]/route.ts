import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import Drawing from "@/models/Drawing";
import type { Status } from "@/types";

type Params = {
  params: Promise<{ drawingId: string }>;
};

function isStatus(value: string): value is Status {
  return ["draft", "in_review", "approved", "rejected", "completed"].includes(value);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { drawingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(drawingId)) {
      throw VALIDATION_ERROR("drawingId 형식이 올바르지 않습니다.");
    }

    const drawing = await Drawing.findOne({ _id: drawingId, siteId });
    if (!drawing) {
      throw NOT_FOUND("도면");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextDrawingNo = body.drawingNo === undefined ? undefined : String(body.drawingNo ?? "").trim();
    const nextDrawingName = body.drawingName === undefined ? undefined : String(body.drawingName ?? "").trim();
    const rawFileAssetId = body.fileAssetId === undefined ? undefined : String(body.fileAssetId ?? "").trim();

    if (nextDrawingNo !== undefined && !nextDrawingNo) {
      throw VALIDATION_ERROR("도면번호는 비워둘 수 없습니다.");
    }
    if (nextDrawingName !== undefined && !nextDrawingName) {
      throw VALIDATION_ERROR("도면명은 비워둘 수 없습니다.");
    }
    if (rawFileAssetId && !mongoose.Types.ObjectId.isValid(rawFileAssetId)) {
      throw VALIDATION_ERROR("fileAssetId 형식이 올바르지 않습니다.");
    }

    if (nextDrawingNo !== undefined) {
      drawing.drawingNo = nextDrawingNo;
    }
    if (nextDrawingName !== undefined) {
      drawing.drawingName = nextDrawingName;
    }
    if (body.discipline !== undefined) {
      drawing.discipline = String(body.discipline ?? "").trim();
    }
    if (body.location !== undefined) {
      drawing.location = String(body.location ?? "").trim();
    }
    if (body.revision !== undefined) {
      drawing.revision = String(body.revision ?? "").trim();
    }
    if (body.status !== undefined) {
      const nextStatus = String(body.status ?? "").trim();
      if (!isStatus(nextStatus)) {
        throw VALIDATION_ERROR("status 값이 올바르지 않습니다.");
      }
      drawing.status = nextStatus;
    }
    if (body.notes !== undefined) {
      drawing.notes = String(body.notes ?? "").trim();
    }
    if (rawFileAssetId !== undefined) {
      drawing.fileAssetId = rawFileAssetId ? new mongoose.Types.ObjectId(rawFileAssetId) : undefined;
    }
    drawing.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await drawing.save();

    logUpdate(siteId, "drawing", drawingId, requester, { updatedFields: Object.keys(body) });
    return success(drawing);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { drawingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(drawingId)) {
      throw VALIDATION_ERROR("drawingId 형식이 올바르지 않습니다.");
    }

    const drawing = await Drawing.findOne({ _id: drawingId, siteId });
    if (!drawing) {
      throw NOT_FOUND("도면");
    }

    drawing.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await drawing.softDelete();
    logDelete(siteId, "drawing", drawingId, requester);
    return success({ id: drawingId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
