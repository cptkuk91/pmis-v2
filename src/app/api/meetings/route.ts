import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertNoUnsafeHtml, assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import Meeting from "@/models/Meeting";
import MeetingAttendee from "@/models/MeetingAttendee";

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

function resolveHostName(fallback: string | null | undefined): string {
  const fallbackValue = String(fallback ?? "").trim();
  return fallbackValue || "담당자 미지정";
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
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const category = String(request.nextUrl.searchParams.get("category") ?? "").trim();
    const dateFrom = request.nextUrl.searchParams.get("dateFrom");
    const dateTo = request.nextUrl.searchParams.get("dateTo");
    const sort = request.nextUrl.searchParams.get("sort") ?? "latest";
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { category: regex },
        { agenda: regex },
        { location: regex },
        { host: regex },
      ];
    }
    if (category && category !== "all") {
      filter.category = category;
    }
    if (dateFrom || dateTo) {
      const range: Record<string, Date> = {};
      if (dateFrom) {
        range.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const inclusiveEnd = new Date(dateTo);
        inclusiveEnd.setDate(inclusiveEnd.getDate() + 1);
        range.$lt = inclusiveEnd;
      }
      filter.meetingDate = range;
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      latest: { meetingDate: -1, createdAt: -1 },
      oldest: { meetingDate: 1, createdAt: 1 },
      agenda_asc: { agenda: 1 },
      agenda_desc: { agenda: -1 },
    };
    const sortOption = sortMap[sort] ?? sortMap.latest;

    const [items, total] = await Promise.all([
      Meeting.find(filter).sort(sortOption).skip(skip).limit(limit).lean(),
      Meeting.countDocuments(filter),
    ]);

    return paginated(items, page, limit, total);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSafeMutationRequest(request);
    const requester = await requireRole("manager");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      throw new ApiError("siteId를 확인할 수 없습니다.", 400, "SITE_REQUIRED");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const category = String(body.category ?? "").trim();
    const agenda = String(body.agenda ?? "").trim();
    const host = resolveHostName(requester.userName);

    if (!category) {
      throw VALIDATION_ERROR("회의구분은 필수입니다.");
    }
    if (!agenda) {
      throw VALIDATION_ERROR("안건은 필수입니다.");
    }
    assertNoUnsafeHtml(category, "회의구분");
    assertNoUnsafeHtml(agenda, "안건");
    assertNoUnsafeHtml(host, "주관");

    const created = await Meeting.create({
      siteId,
      category,
      agenda,
      meetingDate: body.meetingDate ? new Date(String(body.meetingDate)) : new Date(),
      startTime: String(body.startTime ?? "09:00"),
      endTime: String(body.endTime ?? "10:00"),
      location: String(body.location ?? "회의실"),
      host,
      notice: String(body.notice ?? ""),
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    const attendees = Array.isArray(body.attendees) ? body.attendees : [];
    const normalizedAttendees = attendees
      .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
      .map((row) => ({
        company: String(row.company ?? "").trim(),
        department: String(row.department ?? "").trim(),
        position: String(row.position ?? "").trim(),
        name: String(row.name ?? "").trim(),
      }))
      .filter((row) => row.company && row.department && row.position && row.name);

    if (normalizedAttendees.length > 0) {
      await MeetingAttendee.insertMany(
        normalizedAttendees.map((row) => ({
          meetingId: created._id,
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

    logCreate(siteId, "meeting", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
