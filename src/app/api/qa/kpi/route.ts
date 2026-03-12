import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { paginated, success } from "@/lib/api-response";
import { ApiError, handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { assertSafeMutationRequest } from "@/lib/request-security";
import { logCreate } from "@/lib/audit-logger";
import { isQaKpiCycle, isQaKpiSourceMetric } from "@/lib/qa-kpi";
import { normalizeQaKpiDefinitionPayload } from "@/lib/qa-kpi-payload";
import QaKpiDefinition from "@/models/QaKpiDefinition";

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

function parseActiveFilter(value: string) {
  if (value === "all" || value === "active" || value === "inactive") {
    return value;
  }
  throw VALIDATION_ERROR("운영 상태 필터 값이 올바르지 않습니다.");
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    if (!siteId) {
      return paginated([], 1, 10, 0);
    }

    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 10);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const sourceMetric = String(request.nextUrl.searchParams.get("sourceMetric") ?? "all").trim();
    const cycle = String(request.nextUrl.searchParams.get("cycle") ?? "all").trim();
    const active = parseActiveFilter(String(request.nextUrl.searchParams.get("active") ?? "all").trim());
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      siteId: new mongoose.Types.ObjectId(siteId),
    };

    if (keyword) {
      const regex = new RegExp(escapeRegex(keyword), "i");
      filter.$or = [
        { metricCode: regex },
        { metricName: regex },
        { linkedPolicyGoalTitle: regex },
        { linkedPolicyGoalMetricName: regex },
        { ownerName: regex },
        { description: regex },
      ];
    }

    if (sourceMetric !== "all") {
      if (!isQaKpiSourceMetric(sourceMetric)) {
        throw VALIDATION_ERROR("집계 지표 필터 값이 올바르지 않습니다.");
      }
      filter.sourceMetric = sourceMetric;
    }

    if (cycle !== "all") {
      if (!isQaKpiCycle(cycle)) {
        throw VALIDATION_ERROR("집계 주기 필터 값이 올바르지 않습니다.");
      }
      filter.measurementCycle = cycle;
    }

    if (active === "active") {
      filter.isActive = true;
    } else if (active === "inactive") {
      filter.isActive = false;
    }

    const [items, total] = await Promise.all([
      QaKpiDefinition.find(filter).sort({ isActive: -1, updatedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      QaKpiDefinition.countDocuments(filter),
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
    const payload = normalizeQaKpiDefinitionPayload(body);

    const duplicated = await QaKpiDefinition.exists({
      siteId,
      metricCode: payload.metricCode,
    });
    if (duplicated) {
      throw VALIDATION_ERROR("같은 KPI 코드가 이미 등록되어 있습니다.");
    }

    const created = await QaKpiDefinition.create({
      ...payload,
      siteId,
      createdBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
      updatedBy: requester.userId ? new mongoose.Types.ObjectId(requester.userId) : undefined,
    });

    logCreate(siteId, "qa_kpi_definition", String(created._id), requester, {
      metricCode: payload.metricCode,
      sourceMetric: payload.sourceMetric,
      measurementCycle: payload.measurementCycle,
      isActive: payload.isActive,
    });

    return success(created);
  } catch (err) {
    return handleApiError(err);
  }
}
