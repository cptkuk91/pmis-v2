import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertNoUnsafeHtml, assertSafeMutationRequest } from "@/lib/request-security";
import { logUpdate } from "@/lib/audit-logger";
import Meeting from "@/models/Meeting";

type Params = {
  params: Promise<{ meetingId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { meetingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      throw VALIDATION_ERROR("meetingId 형식이 올바르지 않습니다.");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const minutes = String(body.minutes ?? "").trim();
    assertNoUnsafeHtml(minutes, "회의록");
    const rawMinutesFileAssetId =
      body.minutesFileAssetId === undefined ? undefined : String(body.minutesFileAssetId ?? "").trim();
    if (rawMinutesFileAssetId && !mongoose.Types.ObjectId.isValid(rawMinutesFileAssetId)) {
      throw VALIDATION_ERROR("minutesFileAssetId 형식이 올바르지 않습니다.");
    }

    const meeting = await Meeting.findOne({ _id: meetingId, siteId });
    if (!meeting) {
      throw NOT_FOUND("회의");
    }

    meeting.minutes = minutes;
    if (rawMinutesFileAssetId !== undefined) {
      meeting.minutesFileAssetId = rawMinutesFileAssetId
        ? new mongoose.Types.ObjectId(rawMinutesFileAssetId)
        : undefined;
    }
    meeting.minutesUpdatedAt = new Date();
    meeting.updatedBy = requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined;
    await meeting.save();

    logUpdate(siteId, "meeting_minutes", meetingId, requester);
    return success(meeting);
  } catch (err) {
    return handleApiError(err);
  }
}
