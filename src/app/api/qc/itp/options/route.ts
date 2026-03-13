import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { listWorkTypeOptions } from "@/lib/work-type-code";
import QcInspectionTestPlan from "@/models/QcInspectionTestPlan";

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = (await resolveSiteId(request)) || String(request.nextUrl.searchParams.get("siteId") ?? "").trim();
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const [workTypeOptions, itpOptions] = await Promise.all([
      listWorkTypeOptions(siteId),
      QcInspectionTestPlan.find({ siteId, status: { $in: ["draft", "active"] } })
        .sort({ year: -1, versionNo: -1, updatedAt: -1 })
        .limit(100)
        .select({ planTitle: 1, workType: 1, processStep: 1, year: 1, versionNo: 1, status: 1 })
        .lean(),
    ]);

    return success({
      workTypeOptions,
      itpOptions: itpOptions.map((item) => ({
        _id: String(item._id),
        planTitle: item.planTitle,
        workType: item.workType,
        processStep: item.processStep,
        year: item.year,
        versionNo: item.versionNo,
        status: item.status,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
