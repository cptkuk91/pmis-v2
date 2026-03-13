import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import { listWorkTypeOptions } from "@/lib/work-type-code";
import QcNonconformance from "@/models/QcNonconformance";
import QcProcessInspection from "@/models/QcProcessInspection";

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = (await resolveSiteId(request)) || String(request.nextUrl.searchParams.get("siteId") ?? "").trim();
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const [workTypeOptions, processInspectionOptions, ncrOptions] = await Promise.all([
      listWorkTypeOptions(siteId),
      QcProcessInspection.find({ siteId })
        .sort({ plannedInspectionDate: -1, updatedAt: -1 })
        .limit(100)
        .select({ inspectionTitle: 1, workType: 1, location: 1, plannedInspectionDate: 1, status: 1, result: 1 })
        .lean(),
      QcNonconformance.find({ siteId, status: { $ne: "closed" } })
        .sort({ dueDate: 1, severityRank: -1, updatedAt: -1 })
        .limit(100)
        .select({ ncrNo: 1, title: 1, severity: 1, status: 1, dueDate: 1 })
        .lean(),
    ]);

    return success({
      workTypeOptions,
      processInspectionOptions: processInspectionOptions.map((item) => ({
        _id: String(item._id),
        inspectionTitle: item.inspectionTitle ?? "",
        workType: item.workType ?? "",
        location: item.location ?? "",
        plannedInspectionDate: item.plannedInspectionDate ? new Date(item.plannedInspectionDate).toISOString() : "",
        status: item.status ?? "",
        result: item.result ?? "",
      })),
      ncrOptions: ncrOptions.map((item) => ({
        _id: String(item._id),
        ncrNo: item.ncrNo ?? "",
        title: item.title ?? "",
        severity: item.severity ?? "",
        status: item.status ?? "",
        dueDate: item.dueDate ? new Date(item.dueDate).toISOString() : "",
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
