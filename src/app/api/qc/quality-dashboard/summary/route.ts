import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { buildQcQualityDashboardSummary } from "@/lib/qc-ops-summary";

function parseMonthsBack(value: string | null) {
  const parsed = Number(value ?? "6");
  if (!Number.isInteger(parsed) || ![3, 6, 12].includes(parsed)) {
    throw VALIDATION_ERROR("기간은 3, 6, 12개월 중 하나여야 합니다.");
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = (await resolveSiteId(request)) || String(request.nextUrl.searchParams.get("siteId") ?? "").trim();
    const monthsBack = parseMonthsBack(request.nextUrl.searchParams.get("months"));

    if (!siteId) {
      return success({
        generatedAt: new Date().toISOString(),
        range: {
          monthsBack,
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
        snapshot: {
          monthsBack,
          materialInspectionCount: 0,
          materialPassCount: 0,
          materialFailCount: 0,
          materialPassRate: 0,
          processOpenActionCount: 0,
          processFailCount: 0,
          testOutOfSpecCount: 0,
          periodNcrCount: 0,
          openNcrCount: 0,
          overdueNcrCount: 0,
          pendingHandoverCount: 0,
          approvalRequestedHandoverCount: 0,
          topRiskWorkTypeCount: 0,
          topRiskWorkTypes: [],
          overdueNcrs: [],
          pendingHandovers: [],
          failedTests: [],
          openProcessActions: [],
        },
        trend: [],
        workTypeRisks: [],
      });
    }

    const summary = await buildQcQualityDashboardSummary(siteId, { monthsBack, limit: 4, topRiskLimit: 8 });
    return success(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
