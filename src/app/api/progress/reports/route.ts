import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import Report from "@/models/Report";
import { logCreate } from "@/lib/audit-logger";
import type { ReportType } from "@/models/Report";
import type { Status } from "@/types";

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

function isReportType(value: string): value is ReportType {
  return ["supervision", "daily", "weekly"].includes(value);
}

function isStatus(value: string): value is Status {
  return ["draft", "in_review", "approved", "rejected", "completed"].includes(value);
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
    const reportType = String(request.nextUrl.searchParams.get("reportType") ?? "all").trim();
    const status = String(request.nextUrl.searchParams.get("status") ?? "all").trim();
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [{ title: regex }, { content: regex }, { authorName: regex }];
    }
    if (reportType !== "all" && isReportType(reportType)) {
      filter.reportType = reportType;
    }
    if (status !== "all" && isStatus(status)) {
      filter.status = status;
    }

    const [items, total] = await Promise.all([
      Report.find(filter).sort({ reportDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Report.countDocuments(filter),
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
      throw VALIDATION_ERROR("제목은 필수입니다.");
    }

    const reportTypeInput = String(body.reportType ?? "daily");
    const reportType: ReportType = isReportType(reportTypeInput) ? reportTypeInput : "daily";
    const statusInput = String(body.status ?? "draft");
    const status: Status = isStatus(statusInput) ? statusInput : "draft";
    const progressRateValue = Number(body.progressRate ?? 0);
    const progressRate = Number.isFinite(progressRateValue) ? Math.max(0, Math.min(100, progressRateValue)) : 0;

    const created = await Report.create({
      siteId,
      reportType,
      title,
      reportDate: body.reportDate ? new Date(String(body.reportDate)) : new Date(),
      authorName: String(body.authorName ?? requester.userName).trim(),
      content: String(body.content ?? "").trim(),
      progressRate,
      status,
      createdBy: requester.userId ?? undefined,
      updatedBy: requester.userId ?? undefined,
    });

    await logCreate(String(siteId), "progress_report", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
