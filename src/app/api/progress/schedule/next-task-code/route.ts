import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { isProgressScheduleCategory } from "@/lib/progress-schedule-category";
import { findNextProgressScheduleTaskCode } from "@/lib/progress-schedule";

export async function GET(request: NextRequest) {
  try {
    await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const category = String(request.nextUrl.searchParams.get("category") ?? "").trim();
    if (!isProgressScheduleCategory(category)) {
      throw VALIDATION_ERROR("category 파라미터가 올바르지 않습니다.");
    }
    const excludeItemId = String(request.nextUrl.searchParams.get("excludeItemId") ?? "").trim();
    if (excludeItemId && !mongoose.Types.ObjectId.isValid(excludeItemId)) {
      throw VALIDATION_ERROR("excludeItemId 파라미터 형식이 올바르지 않습니다.");
    }

    const taskCode = await findNextProgressScheduleTaskCode(siteId, category, excludeItemId || undefined);
    return success({ taskCode });
  } catch (err) {
    return handleApiError(err);
  }
}
