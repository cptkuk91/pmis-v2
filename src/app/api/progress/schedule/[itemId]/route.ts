import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import ScheduleItem from "@/models/ScheduleItem";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import {
  DEFAULT_PROGRESS_SCHEDULE_CATEGORY,
  isProgressScheduleCategory,
} from "@/lib/progress-schedule-category";
import { findNextProgressScheduleTaskCode, normalizeProgressSchedulePayload } from "@/lib/progress-schedule";

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

    const item = await ScheduleItem.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("공정 항목");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const rawCurrentCategory = String(item.category ?? "");
    const defaultCategory = isProgressScheduleCategory(rawCurrentCategory)
      ? rawCurrentCategory
      : DEFAULT_PROGRESS_SCHEDULE_CATEGORY;
    const payload = normalizeProgressSchedulePayload(body, {
      defaultCategory,
    });
    const requesterObjectId =
      requester.userId && mongoose.Types.ObjectId.isValid(requester.userId)
        ? new mongoose.Types.ObjectId(requester.userId)
        : undefined;
    const shouldRegenerateTaskCode = payload.category !== String(item.category ?? "");

    let saved = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const nextTaskCode = shouldRegenerateTaskCode
        ? await findNextProgressScheduleTaskCode(siteId, payload.category, itemId)
        : String(item.taskCode ?? "");

      item.taskCode = nextTaskCode;
      item.taskName = payload.taskName;
      item.category = payload.category;
      item.plannedStart = payload.plannedStart;
      item.plannedEnd = payload.plannedEnd;
      item.actualStart = payload.actualStart;
      item.actualEnd = payload.actualEnd;
      item.plannedProgress = payload.plannedProgress;
      item.actualProgress = payload.actualProgress;
      item.parentTaskId = payload.parentTaskId;
      item.sortOrder = payload.sortOrder;
      item.updatedBy = requesterObjectId;

      try {
        await item.save();
        saved = true;
        break;
      } catch (error) {
        const isDuplicateTaskCode =
          error instanceof mongoose.mongo.MongoServerError && error.code === 11000;
        if (!shouldRegenerateTaskCode || !isDuplicateTaskCode || attempt === 2) {
          throw error;
        }
      }
    }

    if (!saved) {
      throw new ApiError("작업코드를 생성하지 못했습니다.", 500, "TASK_CODE_GENERATION_FAILED");
    }

    await logUpdate(String(siteId), "progress_schedule", itemId, requester);
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

    const item = await ScheduleItem.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("공정 항목");
    }

    await item.softDelete();
    await logDelete(String(siteId), "progress_schedule", itemId, requester);
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
