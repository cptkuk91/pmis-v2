import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import DesignChange from "@/models/DesignChange";
import Drawing from "@/models/Drawing";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import type { Status } from "@/types";

type Params = {
  params: Promise<{ changeId: string }>;
};

function isStatus(value: string): value is Status {
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

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { changeId } = await params;
    if (!mongoose.Types.ObjectId.isValid(changeId)) {
      throw VALIDATION_ERROR("changeId 형식이 올바르지 않습니다.");
    }

    const change = await DesignChange.findOne({ _id: changeId, siteId });
    if (!change) {
      throw NOT_FOUND("설계변경");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextChangeNo = body.changeNo === undefined ? undefined : String(body.changeNo ?? "").trim();
    const nextStatus = body.status === undefined ? undefined : String(body.status ?? "").trim();

    if (nextChangeNo !== undefined && !nextChangeNo) {
      throw VALIDATION_ERROR("변경번호는 비워둘 수 없습니다.");
    }
    if (nextStatus !== undefined && !isStatus(nextStatus)) {
      throw VALIDATION_ERROR("status 값이 올바르지 않습니다.");
    }

    if (nextChangeNo !== undefined) {
      change.changeNo = nextChangeNo;
    }
    if (body.drawingId !== undefined) {
      const drawing = await resolveDrawingReference(siteId, body.drawingId);
      change.drawingId = new mongoose.Types.ObjectId(drawing.drawingId);
      change.drawingNo = drawing.drawingNo;
      change.drawingName = drawing.drawingName;
      if (body.location === undefined || !String(body.location ?? "").trim()) {
        change.location = drawing.location;
      }
    }
    if (body.location !== undefined) {
      change.location = String(body.location ?? "").trim();
    }
    if (body.reason !== undefined) {
      change.reason = String(body.reason ?? "").trim();
    }
    if (body.requestedByName !== undefined) {
      change.requestedByName = String(body.requestedByName ?? "").trim();
    }
    if (body.reviewedByName !== undefined) {
      change.reviewedByName = String(body.reviewedByName ?? "").trim();
    }
    if (nextStatus !== undefined) {
      change.status = nextStatus;
    }
    if (body.requestedAt !== undefined) {
      change.requestedAt = new Date(String(body.requestedAt));
    }
    if (body.reviewedAt !== undefined) {
      change.reviewedAt = body.reviewedAt ? new Date(String(body.reviewedAt)) : undefined;
    }
    if (body.reviewComment !== undefined) {
      change.reviewComment = String(body.reviewComment ?? "").trim();
    }
    change.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await change.save();

    await logUpdate(String(siteId), "design_change", changeId, requester);
    return success(toChangeSummary(change.toObject()));
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

    const { changeId } = await params;
    if (!mongoose.Types.ObjectId.isValid(changeId)) {
      throw VALIDATION_ERROR("changeId 형식이 올바르지 않습니다.");
    }

    const change = await DesignChange.findOne({ _id: changeId, siteId });
    if (!change) {
      throw NOT_FOUND("설계변경");
    }

    change.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await change.softDelete();
    await logDelete(String(siteId), "design_change", changeId, requester);
    return success({ id: changeId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
