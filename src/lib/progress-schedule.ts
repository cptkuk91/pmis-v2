import mongoose from "mongoose";
import { VALIDATION_ERROR } from "@/lib/api-error";
import ScheduleItem from "@/models/ScheduleItem";
import {
  DEFAULT_PROGRESS_SCHEDULE_CATEGORY,
  buildProgressScheduleTaskCode,
  isProgressScheduleCategory,
  parseProgressScheduleTaskCodeSequence,
  type ProgressScheduleCategory,
} from "@/lib/progress-schedule-category";

export async function findNextProgressScheduleTaskCode(
  siteId: mongoose.Types.ObjectId | string,
  category: ProgressScheduleCategory,
  excludeItemId?: mongoose.Types.ObjectId | string,
): Promise<string> {
  const filter: Record<string, unknown> = { siteId, category };
  if (excludeItemId && mongoose.Types.ObjectId.isValid(String(excludeItemId))) {
    filter._id = { $ne: new mongoose.Types.ObjectId(String(excludeItemId)) };
  }

  const items = await ScheduleItem.find(filter)
    .select({ taskCode: 1 })
    .lean();

  const maxSequence = items.reduce((acc, item) => {
    const next = parseProgressScheduleTaskCodeSequence(category, String(item.taskCode ?? ""));
    return next && next > acc ? next : acc;
  }, 0);

  return buildProgressScheduleTaskCode(category, maxSequence + 1);
}

export type NormalizedProgressSchedulePayload = {
  taskName: string;
  category: ProgressScheduleCategory;
  plannedStart: Date;
  plannedEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;
  plannedProgress: number;
  actualProgress: number;
  parentTaskId?: mongoose.Types.ObjectId;
  sortOrder: number;
};

export function normalizeProgressSchedulePayload(
  body: Record<string, unknown>,
  options: { defaultCategory?: ProgressScheduleCategory } = {},
): NormalizedProgressSchedulePayload {
  const taskName = String(body.taskName ?? "").trim();
  if (!taskName) {
    throw VALIDATION_ERROR("taskName은 필수입니다.");
  }

  const plannedStart = body.plannedStart ? new Date(String(body.plannedStart)) : null;
  const plannedEnd = body.plannedEnd ? new Date(String(body.plannedEnd)) : null;
  if (!plannedStart || Number.isNaN(plannedStart.getTime())) {
    throw VALIDATION_ERROR("plannedStart는 필수입니다.");
  }
  if (!plannedEnd || Number.isNaN(plannedEnd.getTime())) {
    throw VALIDATION_ERROR("plannedEnd는 필수입니다.");
  }

  const rawParentTaskId = String(body.parentTaskId ?? "").trim();
  if (rawParentTaskId && !mongoose.Types.ObjectId.isValid(rawParentTaskId)) {
    throw VALIDATION_ERROR("parentTaskId 형식이 올바르지 않습니다.");
  }

  const plannedProgressValue = Number(body.plannedProgress ?? 0);
  const actualProgressValue = Number(body.actualProgress ?? 0);
  const rawCategory = String(body.category ?? options.defaultCategory ?? DEFAULT_PROGRESS_SCHEDULE_CATEGORY).trim();
  if (!isProgressScheduleCategory(rawCategory)) {
    throw VALIDATION_ERROR("category 값이 올바르지 않습니다.");
  }

  return {
    taskName,
    category: rawCategory,
    plannedStart,
    plannedEnd,
    actualStart: body.actualStart ? new Date(String(body.actualStart)) : undefined,
    actualEnd: body.actualEnd ? new Date(String(body.actualEnd)) : undefined,
    plannedProgress: Number.isFinite(plannedProgressValue) ? Math.max(0, Math.min(100, plannedProgressValue)) : 0,
    actualProgress: Number.isFinite(actualProgressValue) ? Math.max(0, Math.min(100, actualProgressValue)) : 0,
    parentTaskId: rawParentTaskId ? new mongoose.Types.ObjectId(rawParentTaskId) : undefined,
    sortOrder: Number.isFinite(Number(body.sortOrder))
      ? Math.floor(Number(body.sortOrder))
      : 0,
  };
}
