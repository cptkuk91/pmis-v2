import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import { isQaAssurancePlanStatus } from "@/lib/qa-assurance-plans";
import { normalizeQaAssurancePlanPayload } from "@/lib/qa-assurance-plan-payload";
import QaAssurancePlan from "@/models/QaAssurancePlan";

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

type QaAssurancePlanSort = "year_desc" | "year_asc" | "title_asc" | "status_asc";

function parseAssurancePlanSort(value: string): QaAssurancePlanSort {
  if (value === "year_desc" || value === "year_asc" || value === "title_asc" || value === "status_asc") {
    return value;
  }
  throw VALIDATION_ERROR("정렬 값이 올바르지 않습니다.");
}

function getAssurancePlanSort(sort: QaAssurancePlanSort): Record<string, 1 | -1> {
  switch (sort) {
    case "year_asc":
      return { year: 1, versionNo: 1, createdAt: 1 };
    case "title_asc":
      return { planTitle: 1, year: -1, versionNo: -1 };
    case "status_asc":
      return { status: 1, year: -1, versionNo: -1 };
    case "year_desc":
    default:
      return { year: -1, versionNo: -1, createdAt: -1 };
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
    const status = String(request.nextUrl.searchParams.get("status") ?? "all").trim();
    const yearParam = String(request.nextUrl.searchParams.get("year") ?? "").trim();
    const sort = parseAssurancePlanSort(String(request.nextUrl.searchParams.get("sort") ?? "year_desc").trim());
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      siteId: new mongoose.Types.ObjectId(siteId),
    };

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { planTitle: regex },
        { scopeSummary: regex },
        { qualityObjectiveSummary: regex },
        { linkedPolicyGoalTitle: regex },
        { "checkpoints.phaseName": regex },
        { "checkpoints.checkpointTitle": regex },
      ];
    }

    if (status !== "all") {
      if (!isQaAssurancePlanStatus(status)) {
        throw VALIDATION_ERROR("상태 필터 값이 올바르지 않습니다.");
      }
      filter.status = status;
    }

    if (yearParam) {
      const year = Number(yearParam);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw VALIDATION_ERROR("연도 필터 값이 올바르지 않습니다.");
      }
      filter.year = year;
    }

    const [items, total] = await Promise.all([
      QaAssurancePlan.find(filter)
        .sort(getAssurancePlanSort(sort))
        .skip(skip)
        .limit(limit)
        .lean(),
      QaAssurancePlan.countDocuments(filter),
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
    const payload = normalizeQaAssurancePlanPayload(body);

    const created = await QaAssurancePlan.create({
      ...payload,
      siteId,
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    logCreate(siteId, "qa_assurance_plan", String(created._id), requester, {
      year: payload.year,
      versionNo: payload.versionNo,
      status: payload.status,
      checkpointCount: payload.checkpoints.length,
    });

    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
