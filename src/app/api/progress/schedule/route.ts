import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import ScheduleItem from "@/models/ScheduleItem";
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
    const taskCode = String(body.taskCode ?? "").trim();
    const taskName = String(body.taskName ?? "").trim();
    if (!taskCode || !taskName) {
      throw VALIDATION_ERROR("taskCode, taskName은 필수입니다.");
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
    const plannedProgress = Number.isFinite(plannedProgressValue) ? Math.max(0, Math.min(100, plannedProgressValue)) : 0;
    const actualProgress = Number.isFinite(actualProgressValue) ? Math.max(0, Math.min(100, actualProgressValue)) : 0;

    const created = await ScheduleItem.create({
      siteId,
      taskCode,
      taskName,
      category: String(body.category ?? "공정").trim(),
      plannedStart,
      plannedEnd,
      actualStart: body.actualStart ? new Date(String(body.actualStart)) : undefined,
      actualEnd: body.actualEnd ? new Date(String(body.actualEnd)) : undefined,
      plannedProgress,
      actualProgress,
      parentTaskId: rawParentTaskId ? new mongoose.Types.ObjectId(rawParentTaskId) : undefined,
      sortOrder: Number(body.sortOrder ?? 0),
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(String(siteId), "progress_schedule", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
