import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { ApiError, handleApiError, NOT_FOUND, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { logUpdate, logDelete } from "@/lib/audit-logger";
import Meeting from "@/models/Meeting";
import MeetingAttendee from "@/models/MeetingAttendee";

type Params = {
  params: Promise<{ meetingId: string }>;
};

function parseAttendees(input: unknown): Array<{
  company: string;
  department: string;
  position: string;
  name: string;
}> {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({
      company: String(row.company ?? "").trim(),
      department: String(row.department ?? "").trim(),
      position: String(row.position ?? "").trim(),
      name: String(row.name ?? "").trim(),
    }))
    .filter((row) => row.company && row.department && row.position && row.name);
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const { meetingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      throw VALIDATION_ERROR("meetingId 형식이 올바르지 않습니다.");
    }

    const meeting = await Meeting.findOne({ _id: meetingId, siteId }).lean();
    if (!meeting) {
      throw NOT_FOUND("회의");
    }

    const attendees = await MeetingAttendee.find({ meetingId })
      .sort({ createdAt: 1 })
      .lean();

    return success({ meeting, attendees });
  } catch (err) {
    return handleApiError(err);
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

    const { meetingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      throw VALIDATION_ERROR("meetingId 형식이 올바르지 않습니다.");
    }

    const meeting = await Meeting.findOne({ _id: meetingId, siteId });
    if (!meeting) {
      throw NOT_FOUND("회의");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const nextCategory =
      body.category === undefined ? undefined : String(body.category ?? "").trim();
    const nextAgenda =
      body.agenda === undefined ? undefined : String(body.agenda ?? "").trim();

    if (nextCategory !== undefined && !nextCategory) {
      throw VALIDATION_ERROR("회의구분은 비워둘 수 없습니다.");
    }
    if (nextAgenda !== undefined && !nextAgenda) {
      throw VALIDATION_ERROR("안건은 비워둘 수 없습니다.");
    }

    if (nextCategory !== undefined) {
      meeting.category = nextCategory;
    }
    if (nextAgenda !== undefined) {
      meeting.agenda = nextAgenda;
    }
    if (body.meetingDate !== undefined) {
      meeting.meetingDate = new Date(String(body.meetingDate));
    }
    if (body.startTime !== undefined) {
      meeting.startTime = String(body.startTime ?? "").trim();
    }
    if (body.endTime !== undefined) {
      meeting.endTime = String(body.endTime ?? "").trim();
    }
    if (body.location !== undefined) {
      meeting.location = String(body.location ?? "").trim();
    }
    if (body.notice !== undefined) {
      meeting.notice = String(body.notice ?? "").trim();
    }
    meeting.updatedBy = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;

    await meeting.save();

    if (body.attendees !== undefined) {
      const updaterObjectId = requester.userId
        ? new mongoose.Types.ObjectId(requester.userId)
        : undefined;
      await MeetingAttendee.updateMany(
        { meetingId, isDeleted: false },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            ...(updaterObjectId ? { updatedBy: updaterObjectId } : {}),
          },
        },
      );

      const attendees = parseAttendees(body.attendees);
      if (attendees.length > 0) {
        await MeetingAttendee.insertMany(
          attendees.map((row) => ({
            meetingId: meeting._id,
            company: row.company,
            department: row.department,
            position: row.position,
            name: row.name,
            notifySent: false,
            createdBy: requester.userId ?? undefined,
            updatedBy: requester.userId ?? undefined,
          })),
        );
      }
    }

    logUpdate(siteId, "meeting", meetingId, requester, { updatedFields: Object.keys(body) });
    return success(meeting);
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

    const { meetingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(meetingId)) {
      throw VALIDATION_ERROR("meetingId 형식이 올바르지 않습니다.");
    }

    const meeting = await Meeting.findOne({ _id: meetingId, siteId });
    if (!meeting) {
      throw NOT_FOUND("회의");
    }

    const updaterObjectId = requester.userId
      ? new mongoose.Types.ObjectId(requester.userId)
      : undefined;
    meeting.updatedBy = updaterObjectId ?? undefined;
    await meeting.softDelete();

    await MeetingAttendee.updateMany(
      { meetingId, isDeleted: false },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          ...(updaterObjectId ? { updatedBy: updaterObjectId } : {}),
        },
      },
    );

    logDelete(siteId, "meeting", meetingId, requester);
    return success({ id: meetingId, deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
