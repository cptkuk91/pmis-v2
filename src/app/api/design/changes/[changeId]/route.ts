import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import DesignChange from "@/models/DesignChange";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import type { Status } from "@/types";

type Params = {
  params: Promise<{ changeId: string }>;
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
    const nextDrawingNo = body.drawingNo === undefined ? undefined : String(body.drawingNo ?? "").trim();
    const nextDrawingName = body.drawingName === undefined ? undefined : String(body.drawingName ?? "").trim();
    const nextStatus = body.status === undefined ? undefined : String(body.status ?? "").trim();

    if (nextChangeNo !== undefined && !nextChangeNo) {
      throw VALIDATION_ERROR("변경번호는 비워둘 수 없습니다.");
    }
    if (nextDrawingNo !== undefined && !nextDrawingNo) {
      throw VALIDATION_ERROR("도면번호는 비워둘 수 없습니다.");
    }
    if (nextDrawingName !== undefined && !nextDrawingName) {
      throw VALIDATION_ERROR("도면명은 비워둘 수 없습니다.");
    }
    if (nextStatus !== undefined && !isStatus(nextStatus)) {
      throw VALIDATION_ERROR("status 값이 올바르지 않습니다.");
    }

    if (nextChangeNo !== undefined) {
      change.changeNo = nextChangeNo;
    }
    if (nextDrawingNo !== undefined) {
      change.drawingNo = nextDrawingNo;
    }
    if (nextDrawingName !== undefined) {
      change.drawingName = nextDrawingName;
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
    return success(change);
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
