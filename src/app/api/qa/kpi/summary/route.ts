import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { isQaKpiCycle, isQaKpiSourceMetric } from "@/lib/qa-kpi";
import { buildQaKpiSummaryItems, type QaKpiSummaryItem } from "@/lib/qa-kpi-summary";
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

function parseYear(value: string, fallback: number) {
  if (!value) {
    return fallback;
  }
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw VALIDATION_ERROR("연도 필터 값이 올바르지 않습니다.");
  }
  return year;
}

function roundValue(value: number) {
  return Number(value.toFixed(1));
}

function getAlertGap(item: QaKpiSummaryItem) {
  const threshold = item.warningThreshold ?? item.targetValue;
  if (item.targetDirection === "at_least") {
    return threshold - item.currentValue;
  }
  return item.currentValue - threshold;
}

type QaKpiSummarySort = "alert_first" | "achievement_desc" | "achievement_asc" | "metric_code";

function parseKpiSummarySort(value: string): QaKpiSummarySort {
  if (
    value === "alert_first" ||
    value === "achievement_desc" ||
    value === "achievement_asc" ||
    value === "metric_code"
  ) {
    return value;
  }
  throw VALIDATION_ERROR("정렬 값이 올바르지 않습니다.");
}

function sortKpiSummaryItems(items: QaKpiSummaryItem[], sort: QaKpiSummarySort) {
  return [...items].sort((left, right) => {
    if (sort === "achievement_desc") {
      return Number(right.achievementRate ?? 0) - Number(left.achievementRate ?? 0);
    }
    if (sort === "achievement_asc") {
      return Number(left.achievementRate ?? 0) - Number(right.achievementRate ?? 0);
    }
    if (sort === "metric_code") {
      return left.metricCode.localeCompare(right.metricCode, "en");
    }

    if (left.isAlert !== right.isAlert) {
      return left.isAlert ? -1 : 1;
    }
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }
    return left.metricCode.localeCompare(right.metricCode, "en");
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = await resolveSiteId(request);
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const limit = parsePositiveInt(request.nextUrl.searchParams.get("limit"), 10);
    const keyword = String(request.nextUrl.searchParams.get("q") ?? "").trim();
    const sourceMetric = String(request.nextUrl.searchParams.get("sourceMetric") ?? "all").trim();
    const cycle = String(request.nextUrl.searchParams.get("cycle") ?? "all").trim();
    const active = parseActiveFilter(String(request.nextUrl.searchParams.get("active") ?? "all").trim());
    const alertOnly = String(request.nextUrl.searchParams.get("alertOnly") ?? "false").trim() === "true";
    const sort = parseKpiSummarySort(String(request.nextUrl.searchParams.get("sort") ?? "alert_first").trim());
    const year = parseYear(
      String(request.nextUrl.searchParams.get("year") ?? "").trim(),
      new Date().getFullYear(),
    );

    if (!siteId) {
      return success([], {
        page,
        limit,
        total: 0,
        totalPages: 0,
        summary: {
          year,
          definitionCount: 0,
          activeCount: 0,
          alertCount: 0,
          linkedPolicyGoalCount: 0,
          averageAchievementRate: 0,
        },
        alerts: [],
      });
    }

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

    const definitions = await QaKpiDefinition.find(filter)
      .sort({ isActive: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    const summaryItems = await buildQaKpiSummaryItems(
      siteId,
      definitions.map((item) => ({
        ...item,
        _id: String(item._id),
      })),
      year,
    );

    const filteredItems = alertOnly ? summaryItems.filter((item) => item.isAlert) : summaryItems;
    const sortedItems = sortKpiSummaryItems(filteredItems, sort);

    const total = sortedItems.length;
    const pagedItems = sortedItems.slice((page - 1) * limit, page * limit);
    const alertItems = [...filteredItems]
      .filter((item) => item.isAlert)
      .sort((left, right) => getAlertGap(right) - getAlertGap(left))
      .slice(0, 6);

    return success(pagedItems, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      summary: {
        year,
        definitionCount: total,
        activeCount: filteredItems.filter((item) => item.isActive).length,
        alertCount: filteredItems.filter((item) => item.isAlert).length,
        linkedPolicyGoalCount: filteredItems.filter((item) => item.linkedPolicyGoalId).length,
        averageAchievementRate: filteredItems.length
          ? roundValue(
              filteredItems.reduce((sum, item) => sum + Number(item.achievementRate ?? 0), 0) /
                filteredItems.length,
            )
          : 0,
      },
      alerts: alertItems,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
