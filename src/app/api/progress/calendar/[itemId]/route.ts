import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import ProjectCalendarEvent from "@/models/ProjectCalendarEvent";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeProgressCalendarPayload } from "@/lib/progress-calendar";
import { normalizeProgressCalendarCategory } from "@/lib/progress-calendar-category";

type Params = {
  params: Promise<{ itemId: string }>;
};

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

    const item = await ProjectCalendarEvent.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("공정 일정");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload = normalizeProgressCalendarPayload(body, {
      defaultCategory: normalizeProgressCalendarCategory(item.category),
      defaultIsAllDay: item.isAllDay,
    });

    const requesterObjectId =
      requester.userId && mongoose.Types.ObjectId.isValid(requester.userId)
        ? new mongoose.Types.ObjectId(requester.userId)
        : undefined;

    item.title = payload.title;
    item.category = payload.category;
    item.startDate = payload.startDate;
    item.endDate = payload.endDate;
    item.isAllDay = payload.isAllDay;
    item.description = payload.description;
    item.color = payload.color;
    item.updatedBy = requesterObjectId;
    await item.save();

    await logUpdate(String(siteId), "progress_calendar", itemId, requester);
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

    const item = await ProjectCalendarEvent.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("공정 일정");
    }

    await item.softDelete();
    await logDelete(String(siteId), "progress_calendar", itemId, requester);
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
