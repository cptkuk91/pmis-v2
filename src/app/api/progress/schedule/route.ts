import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import ScheduleItem from "@/models/ScheduleItem";
import { logCreate } from "@/lib/audit-logger";
import { isProgressScheduleCategory } from "@/lib/progress-schedule-category";
import { findNextProgressScheduleTaskCode, normalizeProgressSchedulePayload } from "@/lib/progress-schedule";

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

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return success([]);
    }

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 50);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const category = String(request.nextUrl.searchParams.get("category") ?? "all").trim();
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [{ taskCode: regex }, { taskName: regex }, { category: regex }];
    }
    if (category !== "all") {
      if (!isProgressScheduleCategory(category)) {
        throw VALIDATION_ERROR("category 파라미터가 올바르지 않습니다.");
      }
      filter.category = category;
    }

    const [items, total] = await Promise.all([
      ScheduleItem.find(filter)
        .sort({ plannedStart: 1, sortOrder: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ScheduleItem.countDocuments(filter),
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
    const payload = normalizeProgressSchedulePayload(body);
    let created = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const nextTaskCode = await findNextProgressScheduleTaskCode(siteId, payload.category);

      try {
        created = await ScheduleItem.create({
          siteId,
          taskCode: nextTaskCode,
          taskName: payload.taskName,
          category: payload.category,
          plannedStart: payload.plannedStart,
          plannedEnd: payload.plannedEnd,
          actualStart: payload.actualStart,
          actualEnd: payload.actualEnd,
          plannedProgress: payload.plannedProgress,
          actualProgress: payload.actualProgress,
          parentTaskId: payload.parentTaskId,
          sortOrder: payload.sortOrder,
          createdBy: requester.userId ?? undefined,
          updatedBy: requester.userId ?? undefined,
        });
        break;
      } catch (error) {
        const isDuplicateTaskCode =
          error instanceof mongoose.mongo.MongoServerError && error.code === 11000;
        if (!isDuplicateTaskCode || attempt === 2) {
          throw error;
        }
      }
    }

    if (!created) {
      throw new ApiError("작업코드를 생성하지 못했습니다.", 500, "TASK_CODE_GENERATION_FAILED");
    }

    await logCreate(String(siteId), "progress_schedule", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
