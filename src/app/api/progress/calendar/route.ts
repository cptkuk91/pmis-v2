import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import ProjectCalendarEvent from "@/models/ProjectCalendarEvent";
import { logCreate } from "@/lib/audit-logger";
import { normalizeProgressCalendarPayload } from "@/lib/progress-calendar";
import {
  isProgressCalendarCategory,
} from "@/lib/progress-calendar-category";

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

function parseMonthRange(month: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }
  const [rawYear, rawMonth] = month.split("-");
  const year = Number(rawYear);
  const monthIndex = Number(rawMonth) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { start, end };
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
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 20, 300);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const category = String(request.nextUrl.searchParams.get("category") ?? "all").trim();
    const month = String(request.nextUrl.searchParams.get("month") ?? "").trim();
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      siteId,
      category: { $ne: "meeting" },
    };

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [{ title: regex }, { category: regex }, { description: regex }];
    }

    if (category !== "all") {
      if (!isProgressCalendarCategory(category)) {
        throw VALIDATION_ERROR("category 파라미터가 올바르지 않습니다.");
      }
      filter.category = category;
    }

    const monthRange = month ? parseMonthRange(month) : null;
    if (month && !monthRange) {
      throw VALIDATION_ERROR("month 파라미터는 YYYY-MM 형식이어야 합니다.");
    }
    if (monthRange) {
      filter.$and = [
        { startDate: { $lt: monthRange.end } },
        { endDate: { $gte: monthRange.start } },
      ];
    }

    const [items, total] = await Promise.all([
      ProjectCalendarEvent.find(filter)
        .sort({ startDate: 1, endDate: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProjectCalendarEvent.countDocuments(filter),
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
    const payload = normalizeProgressCalendarPayload(body);

    const created = await ProjectCalendarEvent.create({
      siteId,
      title: payload.title,
      category: payload.category,
      startDate: payload.startDate,
      endDate: payload.endDate,
      isAllDay: payload.isAllDay,
      description: payload.description,
      color: payload.color,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(String(siteId), "progress_calendar", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
