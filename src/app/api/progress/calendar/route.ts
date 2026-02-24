import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import ProjectCalendarEvent from "@/models/ProjectCalendarEvent";
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

function parseDateValue(rawValue: unknown, fieldName: string): Date {
  const parsed = new Date(String(rawValue ?? ""));
  if (Number.isNaN(parsed.getTime())) {
    throw VALIDATION_ERROR(`${fieldName} 형식이 올바르지 않습니다.`);
  }
  return parsed;
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
    const category = String(request.nextUrl.searchParams.get("category") ?? "all").trim();
    const month = String(request.nextUrl.searchParams.get("month") ?? "").trim();
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [{ title: regex }, { category: regex }, { description: regex }];
    }

    if (category !== "all") {
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
    const title = String(body.title ?? "").trim();
    if (!title) {
      throw VALIDATION_ERROR("title은 필수입니다.");
    }

    const startDate = parseDateValue(body.startDate, "startDate");
    const endDate = parseDateValue(body.endDate, "endDate");
    if (endDate.getTime() < startDate.getTime()) {
      throw VALIDATION_ERROR("endDate는 startDate보다 빠를 수 없습니다.");
    }

    const created = await ProjectCalendarEvent.create({
      siteId,
      title,
      category: String(body.category ?? "general").trim() || "general",
      startDate,
      endDate,
      isAllDay: Boolean(body.isAllDay ?? true),
      description: String(body.description ?? "").trim(),
      color: String(body.color ?? "#2f76d2").trim() || "#2f76d2",
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(String(siteId), "progress_calendar", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
