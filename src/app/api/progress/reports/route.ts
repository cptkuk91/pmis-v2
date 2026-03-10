import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import Report from "@/models/Report";
import { logCreate } from "@/lib/audit-logger";
import { isProgressReportStatus, isProgressReportType, normalizeProgressReportPayload } from "@/lib/progress-report";

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
    if (reportType !== "all" && isProgressReportType(reportType)) {
      filter.reportType = reportType;
    }
    if (status !== "all" && isProgressReportStatus(status)) {
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
    const payload = normalizeProgressReportPayload(body, {
      defaultReportType: "weekly",
      defaultStatus: "draft",
      defaultAuthorName: requester.userName,
    });
    const requesterObjectId =
      requester.userId && mongoose.Types.ObjectId.isValid(requester.userId)
        ? new mongoose.Types.ObjectId(requester.userId)
        : undefined;

    const created = await Report.create({
      siteId,
      reportType: payload.reportType,
      title: payload.title,
      reportDate: payload.reportDate,
      authorName: payload.authorName,
      content: payload.content,
      progressRate: payload.progressRate,
      attachments: payload.attachments,
      status: payload.status,
      createdBy: requesterObjectId,
      updatedBy: requesterObjectId,
    });

    await logCreate(String(siteId), "progress_report", String(created._id), requester);
    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
