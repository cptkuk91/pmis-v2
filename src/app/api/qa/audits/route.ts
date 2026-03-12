import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import { isQaAuditStatus, isQaAuditType } from "@/lib/qa-audits";
import { normalizeQaAuditPayload } from "@/lib/qa-audit-payload";
import QaAudit from "@/models/QaAudit";

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
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { start, end };
}

type QaAuditSort = "planned_asc" | "planned_desc" | "nonconformity_desc" | "status_asc";

function parseAuditSort(value: string): QaAuditSort {
  if (
    value === "planned_asc" ||
    value === "planned_desc" ||
    value === "nonconformity_desc" ||
    value === "status_asc"
  ) {
    return value;
  }
  throw VALIDATION_ERROR("정렬 값이 올바르지 않습니다.");
}

function getAuditSort(sort: QaAuditSort): Record<string, 1 | -1> {
  switch (sort) {
    case "planned_desc":
      return { plannedDate: -1, createdAt: -1 };
    case "nonconformity_desc":
      return { nonconformityCount: -1, plannedDate: -1, createdAt: -1 };
    case "status_asc":
      return { status: 1, plannedDate: 1, createdAt: -1 };
    case "planned_asc":
    default:
      return { plannedDate: 1, createdAt: -1 };
  }
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
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 10);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const auditType = String(request.nextUrl.searchParams.get("auditType") ?? "all").trim();
    const status = String(request.nextUrl.searchParams.get("status") ?? "all").trim();
    const month = String(request.nextUrl.searchParams.get("month") ?? "").trim();
    const capaOnly = String(request.nextUrl.searchParams.get("capaOnly") ?? "false").trim() === "true";
    const sort = parseAuditSort(String(request.nextUrl.searchParams.get("sort") ?? "planned_asc").trim());
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { siteId: new mongoose.Types.ObjectId(siteId) };
    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { auditTitle: regex },
        { auditeeName: regex },
        { scopeSummary: regex },
        { auditLeadName: regex },
        { resultSummary: regex },
        { "checklistItems.sectionTitle": regex },
        { "checklistItems.itemTitle": regex },
      ];
    }
    if (auditType !== "all") {
      if (!isQaAuditType(auditType)) {
        throw VALIDATION_ERROR("심사 유형 필터 값이 올바르지 않습니다.");
      }
      filter.auditType = auditType;
    }
    if (status !== "all") {
      if (!isQaAuditStatus(status)) {
        throw VALIDATION_ERROR("상태 필터 값이 올바르지 않습니다.");
      }
      filter.status = status;
    }
    if (month) {
      const monthRange = parseMonthRange(month);
      if (!monthRange) {
        throw VALIDATION_ERROR("월 필터는 YYYY-MM 형식이어야 합니다.");
      }
      filter.plannedDate = { $gte: monthRange.start, $lt: monthRange.end };
    }
    if (capaOnly) {
      filter.capaRequestedCount = { $gt: 0 };
    }

    const [items, total] = await Promise.all([
      QaAudit.find(filter)
        .sort(getAuditSort(sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      QaAudit.countDocuments(filter),
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
    const payload = normalizeQaAuditPayload(body);

    const created = await QaAudit.create({
      ...payload,
      siteId,
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    logCreate(siteId, "qa_audit", String(created._id), requester, {
      auditType: payload.auditType,
      status: payload.status,
      nonconformityCount: payload.nonconformityCount,
      capaRequestedCount: payload.capaRequestedCount,
    });

    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
