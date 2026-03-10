import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import DailySafetyLog from "@/models/DailySafetyLog";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeDailySafetyLogPayload } from "@/lib/daily-safety-log";

type Params = {
  params: Promise<{ itemId: string }>;
};

function assertEditableStatus(status: string, action: "수정" | "삭제") {
  if (status !== "draft" && status !== "completed") {
    throw new ApiError(
      `임시저장 또는 완료 상태의 안전 일지만 ${action}할 수 있습니다.`,
      409,
      "DAILY_SAFETY_LOG_NOT_EDITABLE",
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const item = await DailySafetyLog.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("안전 일지");
    }
    assertEditableStatus(item.status, "수정");

    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeDailySafetyLogPayload(body, {
      defaultStatus: item.status,
      defaultManagerName: item.managerName,
    });

    item.logDate = payload.logDate;
    item.weather = payload.weather;
    item.workersCount = payload.workersCount;
    item.hazards = payload.hazards;
    item.actions = payload.actions;
    item.notes = payload.notes;
    item.managerName = payload.managerName;
    item.status = payload.status;
    item.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await item.save();

    await logUpdate(String(siteId), "daily_safety_log", itemId, requester);
    return success(item);
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

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const item = await DailySafetyLog.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("안전 일지");
    }
    assertEditableStatus(item.status, "삭제");

    await item.softDelete();
    await logDelete(String(siteId), "daily_safety_log", itemId, requester);
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
