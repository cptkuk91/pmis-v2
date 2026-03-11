import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import WorkforceAttendance from "@/models/WorkforceAttendance";
import { success } from "@/lib/api-response";
import { handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { logDelete, logUpdate } from "@/lib/audit-logger";
import { normalizeWorkforceAttendancePayload } from "@/lib/workforce-attendance";

type Params = {
  params: Promise<{ itemId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await connectDB();

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload = await normalizeWorkforceAttendancePayload(body);

    const item = await WorkforceAttendance.findOne({ _id: itemId, siteId: payload.siteId });
    if (!item) {
      throw NOT_FOUND("일일 근태");
    }

    item.attendanceDate = payload.attendanceDate;
    item.workerName = payload.workerName;
    item.company = payload.company || undefined;
    item.jobType = payload.jobType || undefined;
    item.workType = payload.workType || undefined;
    item.isPresent = payload.isPresent;
    item.hoursWorked = payload.hoursWorked;
    item.overtimeHours = payload.overtimeHours;
    await item.save();

    await logUpdate(payload.siteId, "workforce_daily", itemId, { userId: null, userName: "system" });
    return success(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await connectDB();

    const { itemId } = await params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw VALIDATION_ERROR("itemId 형식이 올바르지 않습니다.");
    }

    const siteId = String(request.nextUrl.searchParams.get("siteId") ?? "").trim();
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const item = await WorkforceAttendance.findOne({ _id: itemId, siteId });
    if (!item) {
      throw NOT_FOUND("일일 근태");
    }

    await item.softDelete();
    await logDelete(siteId, "workforce_daily", itemId, { userId: null, userName: "system" });
    return success({ id: itemId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
