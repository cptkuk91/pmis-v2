import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { success } from "@/lib/api-response";
import { handleApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { requireRole } from "@/lib/permissions";
import { resolveSiteId } from "@/lib/site-context";
import MaterialInspection from "@/models/MaterialInspection";
import QcProcessInspection from "@/models/QcProcessInspection";

export async function GET(request: NextRequest) {
  try {
    await requireRole("viewer");
    await connectDB();

    const siteId = (await resolveSiteId(request)) || String(request.nextUrl.searchParams.get("siteId") ?? "").trim();
    if (!siteId) {
      throw VALIDATION_ERROR("siteId가 필요합니다.");
    }

    const [materialOptions, processOptions] = await Promise.all([
      MaterialInspection.find({ siteId })
        .sort({ inspectionDate: -1, updatedAt: -1 })
        .limit(100)
        .select({ materialName: 1, specification: 1, inspectionDate: 1, result: 1 })
        .lean(),
      QcProcessInspection.find({ siteId })
        .sort({ plannedInspectionDate: -1, updatedAt: -1 })
        .limit(100)
        .select({ inspectionTitle: 1, location: 1, plannedInspectionDate: 1, result: 1, status: 1 })
        .lean(),
    ]);

    return success({
      materialInspectionOptions: materialOptions.map((item) => ({
        _id: String(item._id),
        label: `${item.materialName}${item.specification ? ` / ${item.specification}` : ""}`,
        materialName: item.materialName ?? "",
        specification: item.specification ?? "",
        inspectionDate: item.inspectionDate,
        result: item.result ?? "pending",
      })),
      processInspectionOptions: processOptions.map((item) => ({
        _id: String(item._id),
        label: `${item.inspectionTitle}${item.location ? ` / ${item.location}` : ""}`,
        inspectionTitle: item.inspectionTitle ?? "",
        location: item.location ?? "",
        plannedInspectionDate: item.plannedInspectionDate,
        result: item.result ?? "pending",
        status: item.status ?? "scheduled",
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
